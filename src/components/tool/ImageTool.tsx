"use client";

import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { track, sizeBucket } from "@/lib/analytics";
import { FORMAT_SNIFF_BYTES, detectImageFormat } from "@/lib/image/formats";
import type { ProgressStage } from "@/lib/image/pipeline";
import { isImageProcessingSupported } from "@/lib/image/support";
import type { ImageProcessingResult } from "@/lib/image/worker/protocol";
import type { ImagePreset } from "@/lib/presets/types";
import { INITIAL_CROP, type ViewportCrop } from "@/lib/tools/cropper";
import { ERROR_COPY, errorMessageFor, isRetryable } from "@/lib/tools/error-copy";
import { buildDownloadFilename, documentNoun } from "@/lib/tools/preset-labels";
import {
  buildChecklist,
  deriveResultState,
  type ResultState,
  type ToolUiState,
} from "@/lib/tools/result-state";
import { checkInputFile, formatBytes } from "@/lib/validation/validate";
import { Cropper } from "./Cropper";
import { DownloadButton } from "./DownloadButton";
import { ImageUploader } from "./ImageUploader";
import { ProcessingProgress } from "./ProcessingProgress";
import { RequirementsSummary } from "./RequirementsSummary";
import { ResultPreview } from "./ResultPreview";
import { ValidationChecklist } from "./ValidationChecklist";

interface SelectedImage {
  file: File;
  url: string;
  width: number;
  height: number;
}

interface ToolError {
  message: string;
  retryable: boolean;
}

type State =
  | { phase: "select"; error: string | null; busy: boolean }
  | { phase: "crop"; source: SelectedImage; crop: ViewportCrop }
  | { phase: "processing"; source: SelectedImage; crop: ViewportCrop; stage: ProgressStage | null }
  | {
      phase: "result";
      source: SelectedImage;
      crop: ViewportCrop;
      result: ImageProcessingResult;
      resultUrl: string;
      state: ResultState;
    }
  | { phase: "error"; source: SelectedImage | null; crop: ViewportCrop; error: ToolError };

type Action =
  | { type: "opening" }
  | { type: "rejected"; error: string }
  | { type: "selected"; source: SelectedImage }
  | { type: "crop"; crop: ViewportCrop }
  | { type: "start" }
  | { type: "progress"; stage: ProgressStage }
  | { type: "done"; result: ImageProcessingResult; resultUrl: string }
  | { type: "failed"; error: ToolError }
  | { type: "adjust" }
  | { type: "reset" };

const INITIAL: State = { phase: "select", error: null, busy: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "opening":
      return { phase: "select", error: null, busy: true };
    case "rejected":
      return { phase: "select", error: action.error, busy: false };
    case "selected":
      return { phase: "crop", source: action.source, crop: INITIAL_CROP };
    case "crop":
      return state.phase === "crop" ? { ...state, crop: action.crop } : state;
    case "start":
      return state.phase === "crop" || (state.phase === "error" && state.source)
        ? { phase: "processing", source: state.source!, crop: state.crop, stage: null }
        : state;
    case "progress":
      return state.phase === "processing" ? { ...state, stage: action.stage } : state;
    case "done":
      return state.phase === "processing"
        ? {
            phase: "result",
            source: state.source,
            crop: state.crop,
            result: action.result,
            resultUrl: action.resultUrl,
            state: deriveResultState(action.result),
          }
        : state;
    case "failed":
      return state.phase === "processing"
        ? { phase: "error", source: state.source, crop: state.crop, error: action.error }
        : state;
    case "adjust":
      return state.phase === "result" || state.phase === "error"
        ? state.source
          ? { phase: "crop", source: state.source, crop: state.crop }
          : INITIAL
        : state;
    case "reset":
      return INITIAL;
  }
}

function uiStateOf(state: State): ToolUiState {
  switch (state.phase) {
    case "select":
      return "SELECT";
    case "crop":
      return "CROP";
    case "processing":
      return "PROCESSING";
    case "result":
      return state.state;
    case "error":
      return "ERROR";
  }
}

const noopSubscribe = () => () => {};

function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  return image.decode().then(() => ({ width: image.naturalWidth, height: image.naturalHeight }));
}

const RESULT_HEADINGS: Record<ResultState, string> = {
  READY: "Ready to upload",
  READY_WITH_WARNING: "Ready — with a warning",
  INVALID: "This doesn't meet the requirements",
};

/** Snapshot reported to an embedding component (e.g. the Complete Pack). */
export interface ImageToolStatus {
  state: ToolUiState | "UNSUPPORTED";
  /** A file was rejected or processing failed. */
  hasError: boolean;
  /** Final file, only when downloadable (READY or READY_WITH_WARNING). */
  output: { blob: Blob; filename: string } | null;
}

interface ImageToolProps {
  preset: ImagePreset;
  /** Tool id for analytics. */
  toolId: string;
  /** Heading level for step headings: 2 on a tool page, 3 when embedded in a section. */
  headingLevel?: 2 | 3;
  onStatusChange?: (status: ImageToolStatus) => void;
}

/**
 * Upload → crop → process → validate → preview → download, for any preset.
 * The image never leaves the browser; processing runs in the image worker,
 * which is loaded only when needed.
 */
export function ImageTool({ preset, toolId, headingLevel = 2, onStatusChange }: ImageToolProps) {
  const Heading = (headingLevel === 3 ? "h3" : "h2") as "h2";
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const supported = useSyncExternalStore(noopSubscribe, isImageProcessingSupported, () => true);
  const urls = useRef(new Set<string>());
  const abort = useRef<AbortController | null>(null);
  const selection = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(state.phase);

  const noun = documentNoun(preset);
  const filename = buildDownloadFilename(preset);
  const target = { width: preset.width, height: preset.height };
  const baseProps = { tool_id: toolId, preset_id: preset.id };
  const uiState = uiStateOf(state);

  const createUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const releaseUrl = (url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  };
  const releaseAll = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    selection.current++;
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
  }, []);

  useEffect(() => {
    track("tool_open", { tool_id: toolId, preset_id: preset.id });
  }, [toolId, preset.id]);

  useEffect(() => releaseAll, [releaseAll]);

  const resultBlob = state.phase === "result" ? state.result.blob : null;
  const hasError = state.phase === "select" ? state.error !== null : state.phase === "error";
  useEffect(() => {
    const downloadable = uiState === "READY" || uiState === "READY_WITH_WARNING";
    onStatusChange?.({
      state: supported ? uiState : "UNSUPPORTED",
      hasError,
      output: downloadable && resultBlob ? { blob: resultBlob, filename } : null,
    });
  }, [onStatusChange, supported, uiState, hasError, resultBlob, filename]);

  // Move focus to the new step's heading (not on first render).
  useEffect(() => {
    if (previousPhase.current !== state.phase) {
      previousPhase.current = state.phase;
      headingRef.current?.focus();
    }
  }, [state.phase]);

  const handleFile = async (file: File) => {
    const token = ++selection.current;
    dispatch({ type: "opening" });
    const head = new Uint8Array(await file.slice(0, FORMAT_SNIFF_BYTES).arrayBuffer());
    const format = detectImageFormat(head);
    const rejection = checkInputFile({ byteLength: file.size, format });
    if (token !== selection.current) return;
    if (rejection) {
      track("image_selected", { ...baseProps, accepted: false, reason: rejection });
      dispatch({ type: "rejected", error: errorMessageFor(rejection) });
      return;
    }
    const url = createUrl(file);
    try {
      const size = await loadImageSize(url);
      if (token !== selection.current) return;
      dispatch({ type: "selected", source: { file, url, ...size } });
      track("image_selected", {
        ...baseProps,
        accepted: true,
        input_format: format ?? "unknown",
        size_bucket: sizeBucket(file.size),
      });
      track("crop_started", baseProps);
      // Warm up the engine client while the user crops.
      void import("@/lib/image/worker/client");
    } catch {
      releaseUrl(url);
      if (token !== selection.current) return;
      track("image_selected", { ...baseProps, accepted: false, reason: "decode-failed" });
      dispatch({ type: "rejected", error: ERROR_COPY.unreadable });
    }
  };

  const startProcessing = async () => {
    if (state.phase !== "crop" && !(state.phase === "error" && state.source)) return;
    const source = state.source!;
    const { crop } = state;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    dispatch({ type: "start" });
    if (state.phase === "crop") track("crop_completed", { ...baseProps, zoom: crop.zoom });
    track("processing_started", baseProps);
    const started = performance.now();

    let outcome: Awaited<ReturnType<typeof import("@/lib/image/worker/client").processImage>>;
    try {
      const { processImage } = await import("@/lib/image/worker/client");
      outcome = await processImage(source.file, {
        requirements: preset,
        crop,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) dispatch({ type: "progress", stage: progress.stage });
        },
      });
    } catch {
      outcome = {
        ok: false,
        error: { code: "internal-error", stage: "worker", message: ERROR_COPY.processing },
      };
    }
    if (controller.signal.aborted) return;
    abort.current = null;

    const durationMs = Math.round(performance.now() - started);
    if (!outcome.ok) {
      track("processing_completed", { ...baseProps, ok: false, error_code: outcome.error.code });
      dispatch({
        type: "failed",
        error: {
          message: errorMessageFor(outcome.error.code),
          retryable: isRetryable(outcome.error.code),
        },
      });
      return;
    }

    const { result } = outcome;
    const resultUrl = createUrl(result.blob);
    dispatch({ type: "done", result, resultUrl });
    track("processing_completed", {
      ...baseProps,
      ok: true,
      duration_ms: durationMs,
      quality: result.compression.quality,
    });
    const resultState = deriveResultState(result);
    if (resultState === "READY") track("validation_passed", baseProps);
    else if (resultState === "READY_WITH_WARNING") {
      track("validation_warning", { ...baseProps, status: result.compression.status });
    } else {
      const failed = result.validation.checks.filter((c) => c.status === "fail").map((c) => c.id);
      track("validation_failed", { ...baseProps, checks: failed.join(",") });
    }
  };

  const reset = () => {
    releaseAll();
    dispatch({ type: "reset" });
    track("tool_reset", baseProps);
  };

  const adjustCrop = () => {
    if (state.phase === "result") releaseUrl(state.resultUrl);
    dispatch({ type: "adjust" });
  };

  const onDownload = () => {
    track("download_clicked", { ...baseProps, state: uiState });
    // Browsers don't report when a save finishes; this marks the hand-off.
    setTimeout(() => track("download_completed", baseProps), 0);
  };

  const announcement =
    state.phase === "processing"
      ? "Processing your image"
      : state.phase === "result"
        ? `${RESULT_HEADINGS[state.state]}.`
        : state.phase === "error"
          ? state.error.message
          : state.phase === "crop"
            ? "Image loaded. Adjust the crop, then process."
            : "";

  const headingClass = "text-lg font-semibold outline-none";
  const secondaryButton =
    "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-border bg-background px-5 py-3 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto";

  if (!supported) {
    return (
      <section
        aria-labelledby="tool-unsupported"
        data-state="UNSUPPORTED"
        className="rounded-xl border border-border p-4"
      >
        <Heading id="tool-unsupported" className={headingClass}>
          Your browser can&apos;t run this tool
        </Heading>
        <p className="mt-2 text-muted">
          {ERROR_COPY.browser} Please update your browser, or open this page in a recent version of
          Chrome, Edge, Firefox or Safari (16.4 or later).
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label={`${preset.label} tool`}
      data-testid="image-tool"
      data-state={uiState}
      className="rounded-xl border border-border p-4 shadow-sm sm:p-6"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {state.phase === "select" ? (
        <div className="space-y-4">
          <Heading ref={headingRef} tabIndex={-1} className="sr-only">
            Choose your {noun}
          </Heading>
          <RequirementsSummary preset={preset} headingLevel={headingLevel} />
          <ImageUploader noun={noun} onSelect={handleFile} error={state.error} busy={state.busy} />
        </div>
      ) : null}

      {state.phase === "crop" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Heading ref={headingRef} tabIndex={-1} className={headingClass}>
                Adjust the crop
              </Heading>
              <p className="truncate text-sm text-muted" data-testid="selected-file">
                {state.source.file.name} · {formatBytes(state.source.file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 text-sm font-medium underline"
            >
              Change {noun}
            </button>
          </div>
          <p className="text-sm text-muted">
            Drag to position your {noun} in the frame. Use + and − to zoom. The frame matches the
            required {preset.width} × {preset.height} shape, so nothing is stretched.
          </p>
          <Cropper
            imageUrl={state.source.url}
            imageSize={{ width: state.source.width, height: state.source.height }}
            target={target}
            value={state.crop}
            onChange={(crop) => dispatch({ type: "crop", crop })}
            label={`Crop area for your ${noun}`}
          />
          <button
            type="button"
            onClick={startProcessing}
            className="min-h-12 w-full rounded-lg bg-brand px-6 py-3 text-lg font-semibold text-brand-foreground shadow-sm hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Process {noun}
          </button>
        </div>
      ) : null}

      {state.phase === "processing" ? (
        <div>
          <Heading ref={headingRef} tabIndex={-1} className={headingClass}>
            Processing your {noun}
          </Heading>
          <p className="text-sm text-muted">This happens on your device.</p>
          <ProcessingProgress stage={state.stage} />
        </div>
      ) : null}

      {state.phase === "result" ? (
        <div className="space-y-4">
          <Heading
            ref={headingRef}
            tabIndex={-1}
            className={headingClass}
            data-testid="result-heading"
          >
            <span aria-hidden="true" className="mr-2">
              {state.state === "READY" ? "✓" : state.state === "READY_WITH_WARNING" ? "⚠" : "✕"}
            </span>
            {RESULT_HEADINGS[state.state]}
          </Heading>

          <ValidationChecklist items={buildChecklist(state.result)} />

          {state.state === "READY_WITH_WARNING" ? (
            <div
              className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm"
              data-testid="size-warning"
            >
              <p className="font-semibold">
                Your processed image is smaller than the stated minimum file size.
              </p>
              <p className="mt-1">
                We kept the highest-quality version instead of adding artificial data. The
                application website may still enforce its own minimum-size check. If it rejects the
                file, try a sharper or higher-resolution original {noun}.
              </p>
            </div>
          ) : null}

          {state.state === "INVALID" ? (
            <div
              className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm"
              role="alert"
            >
              <p className="font-semibold">This file would likely be rejected.</p>
              <p className="mt-1">
                {state.result.compression.message ??
                  "Adjust the crop or try a different original, then process again."}
              </p>
            </div>
          ) : null}

          <ResultPreview
            original={{
              url: state.source.url,
              width: state.result.source.width,
              height: state.result.source.height,
              byteLength: state.source.file.size,
            }}
            final={{
              url: state.resultUrl,
              width: state.result.facts.width,
              height: state.result.facts.height,
              byteLength: state.result.facts.byteLength,
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            {state.state !== "INVALID" ? (
              <DownloadButton href={state.resultUrl} filename={filename} onDownload={onDownload}>
                {state.state === "READY" ? "Download JPG" : "Download Anyway"}
              </DownloadButton>
            ) : null}
            <button type="button" onClick={adjustCrop} className={secondaryButton}>
              Adjust crop
            </button>
            <button type="button" onClick={reset} className={secondaryButton}>
              Start again
            </button>
          </div>
        </div>
      ) : null}

      {state.phase === "error" ? (
        <div className="space-y-4">
          <Heading ref={headingRef} tabIndex={-1} className={headingClass}>
            Something went wrong
          </Heading>
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-4">
            {state.error.message}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {state.error.retryable && state.source ? (
              <button type="button" onClick={startProcessing} className={secondaryButton}>
                Try again
              </button>
            ) : null}
            <button type="button" onClick={reset} className={secondaryButton}>
              Choose another {noun}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
