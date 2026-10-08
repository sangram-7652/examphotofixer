"use client";

import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { fileSizeBucket, megapixelBucket, trackEvent } from "@/lib/analytics";
import { primaryReasonCode } from "@/lib/analytics/reasons";
import { trackJobResult } from "@/lib/analytics/tool-events";
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
import { formatBytes } from "@/lib/validation/validate";
import { Cropper } from "./Cropper";
import { DownloadButton } from "./DownloadButton";
import { readSelectedImage } from "./image-job";
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

const RESULT_HEADINGS: Record<ResultState, string> = {
  READY: "Ready to upload",
  READY_WITH_WARNING: "Review before downloading",
  INVALID: "This doesn't meet the requirements",
};

/** Status band under each result heading: colour plus symbol and words, never colour alone. */
const RESULT_BANNER: Record<ResultState, { className: string; text: string }> = {
  READY: {
    className: "border-success/30 bg-success-soft text-success",
    text: "Every check passed. Download the file and upload it to the form.",
  },
  READY_WITH_WARNING: {
    className: "border-warning/30 bg-warning-soft text-warning",
    text: "One check needs your attention. Read why below before you download.",
  },
  INVALID: {
    className: "border-danger/30 bg-danger-soft text-danger",
    text: "This file doesn't meet the requirements, so it can't be downloaded here.",
  },
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
  /** True inside a pack: the pack reports its own view, and events carry `tool_type: "pack"`. */
  embedded?: boolean;
  /** Heading level for step headings: 2 on a tool page, 3 when embedded in a section. */
  headingLevel?: 2 | 3;
  onStatusChange?: (status: ImageToolStatus) => void;
}

/**
 * Upload → crop → process → validate → preview → download, for any preset.
 * The image never leaves the browser; processing runs in the image worker,
 * which is loaded only when needed.
 */
export function ImageTool({
  preset,
  toolId,
  embedded = false,
  headingLevel = 2,
  onStatusChange,
}: ImageToolProps) {
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
  // Only controlled identifiers; never file names or image-derived values.
  const baseProps = {
    tool_id: toolId,
    tool_type: embedded ? "pack" : "preset",
    exam_id: preset.exam,
    asset_type: preset.documentType,
    output_format: "jpeg",
  };
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
    if (!embedded)
      trackEvent("tool_viewed", { tool_id: toolId, tool_type: "preset", exam_id: preset.exam });
  }, [embedded, toolId, preset.exam]);

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
    const selected = await readSelectedImage(file, createUrl, releaseUrl);
    if (token !== selection.current) {
      if (selected.ok) releaseUrl(selected.image.url);
      return;
    }
    if (!selected.ok) {
      trackEvent("image_selected", {
        ...baseProps,
        accepted: false,
        error_code: selected.reason,
        input_size_bucket: fileSizeBucket(file.size),
      });
      dispatch({
        type: "rejected",
        error:
          selected.reason === "unreadable"
            ? ERROR_COPY.unreadable
            : errorMessageFor(selected.reason),
      });
      return;
    }
    const { url, width, height, format } = selected.image;
    dispatch({ type: "selected", source: { file, url, width, height } });
    trackEvent("image_selected", {
      ...baseProps,
      accepted: true,
      input_format: format,
      input_size_bucket: fileSizeBucket(file.size),
      input_megapixel_bucket: megapixelBucket(width, height),
    });
    // Warm up the engine client while the user crops.
    void import("@/lib/image/worker/client");
  };

  const startProcessing = async () => {
    if (state.phase !== "crop" && !(state.phase === "error" && state.source)) return;
    const source = state.source!;
    const { crop } = state;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    dispatch({ type: "start" });
    trackEvent("processing_started", baseProps);

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

    if (!outcome.ok) {
      trackJobResult(baseProps, "ERROR", { error_code: outcome.error.code });
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
    const resultState = deriveResultState(result);
    trackEvent("processing_completed", {
      ...baseProps,
      result_state: resultState,
      output_size_bucket: fileSizeBucket(result.facts.byteLength),
      output_megapixel_bucket: megapixelBucket(result.facts.width, result.facts.height),
    });
    trackJobResult(baseProps, resultState, {
      reason_code: primaryReasonCode({
        checks: result.validation.checks,
        compressionStatus: result.compression.status,
        outputDpi: result.facts.dpi,
      }),
    });
  };

  const reset = () => {
    releaseAll();
    dispatch({ type: "reset" });
  };

  const adjustCrop = () => {
    if (state.phase === "result") releaseUrl(state.resultUrl);
    dispatch({ type: "adjust" });
  };

  const onDownload = () => {
    const props = { ...baseProps, result_state: uiState };
    trackEvent("download_started", props);
    // Browsers don't report when a save finishes; this marks the hand-off to the browser.
    setTimeout(() => trackEvent("download_completed", props), 0);
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
  const secondaryButton = "btn-secondary w-full sm:w-auto";

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
      className="card p-4 sm:p-6"
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
          <ImageUploader
            noun={noun}
            onSelect={handleFile}
            error={state.error}
            busy={state.busy}
            captureCaveat={preset.captureCaveat}
          />
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
          <button type="button" onClick={startProcessing} className="btn-primary w-full text-lg">
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
          <div
            className={`-mx-4 -mt-4 border-b px-4 py-4 sm:-mx-6 sm:-mt-6 sm:rounded-t-xl sm:px-6 ${RESULT_BANNER[state.state].className}`}
          >
            <Heading
              ref={headingRef}
              tabIndex={-1}
              className="flex items-center gap-2.5 font-display text-xl font-semibold outline-none"
              data-testid="result-heading"
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-base"
              >
                {state.state === "READY" ? "✓" : state.state === "READY_WITH_WARNING" ? "⚠" : "✕"}
              </span>
              {RESULT_HEADINGS[state.state]}
            </Heading>
            <p className="mt-1 text-sm text-foreground/80">{RESULT_BANNER[state.state].text}</p>
          </div>

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
