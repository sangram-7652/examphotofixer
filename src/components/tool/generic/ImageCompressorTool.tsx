"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { fileSizeBucket, megapixelBucket, trackEvent } from "@/lib/analytics";
import { primaryReasonCode } from "@/lib/analytics/reasons";
import { trackJobResult } from "@/lib/analytics/tool-events";
import { FORMAT_LABELS } from "@/lib/image/formats";
import { MAX_CANVAS_PIXELS } from "@/lib/image/limits";
import {
  detectEncodableFormats,
  isImageProcessingSupported,
  type EncodableFormats,
} from "@/lib/image/support";
import type { ImageProcessingResult } from "@/lib/image/worker/protocol";
import { ERROR_COPY, errorMessageFor, isRetryable } from "@/lib/tools/error-copy";
import { transparencyWarning } from "@/lib/tools/generic/common";
import {
  COMPRESS_FORMATS,
  DEFAULT_MAX_BYTES,
  SIZE_PRESETS,
  compressFilename,
  defaultCompressFormat,
  deriveCompressionOutcome,
  parseCustomKB,
  savedPercent,
  toCompressJob,
  type CompressFormat,
  type CompressionOutcome,
} from "@/lib/tools/generic/compress";
import { formatByteLimit, formatBytes } from "@/lib/validation/validate";
import { DownloadButton } from "../DownloadButton";
import { ImageUploader } from "../ImageUploader";
import { ProcessingProgress } from "../ProcessingProgress";
import { ResultPreview } from "../ResultPreview";
import { readSelectedImage, useImageJob, useObjectUrls, type SelectedImage } from "../image-job";
import {
  FormatChoice,
  Notice,
  RadioOption,
  SourceDetails,
  primaryButton,
  secondaryButton,
} from "./SettingsParts";

const TOOL_ID = "image-compressor";
const TOOL_TYPE = "generic-compress";
const noopSubscribe = () => () => {};

interface Settings {
  /** Preset id, or "custom". */
  choice: string;
  customKB: string;
  format: CompressFormat;
}

type State =
  | { phase: "select"; error: string | null; busy: boolean }
  | { phase: "configure"; image: SelectedImage; settings: Settings }
  | { phase: "processing"; image: SelectedImage; settings: Settings }
  | {
      phase: "result";
      image: SelectedImage;
      settings: Settings;
      maxBytes: number;
      result: ImageProcessingResult;
      resultUrl: string;
      outcome: CompressionOutcome;
      dimensionsReduced: boolean;
    }
  | {
      phase: "error";
      image: SelectedImage;
      settings: Settings;
      message: string;
      retryable: boolean;
    };

const defaultChoice = SIZE_PRESETS.find((p) => p.bytes === DEFAULT_MAX_BYTES)!.id;

function maxBytesFor(settings: Settings): { bytes: number } | { error: string } {
  if (settings.choice === "custom") return parseCustomKB(settings.customKB);
  const preset = SIZE_PRESETS.find((p) => p.id === settings.choice);
  return preset ? { bytes: preset.bytes } : { error: "Choose a maximum file size." };
}

/**
 * Generic Image Compressor: keeps dimensions, finds the best quality under a
 * maximum size using the engine's search, and judges the result only by the
 * actual encoded bytes.
 */
export function ImageCompressorTool() {
  const [state, setState] = useState<State>({ phase: "select", error: null, busy: false });
  const [encodable, setEncodable] = useState<EncodableFormats | null>(null);
  const supported = useSyncExternalStore(noopSubscribe, isImageProcessingSupported, () => true);
  const urls = useObjectUrls();
  const job = useImageJob();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(state.phase);
  const selection = useRef(0);
  const customId = useId();

  useEffect(() => {
    trackEvent("tool_viewed", { tool_id: TOOL_ID, tool_type: TOOL_TYPE });
    let active = true;
    detectEncodableFormats().then((formats) => {
      if (active) setEncodable(formats);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (previousPhase.current !== state.phase) {
      previousPhase.current = state.phase;
      headingRef.current?.focus();
    }
  }, [state.phase]);

  const handleFile = async (file: File) => {
    const token = ++selection.current;
    setState({ phase: "select", error: null, busy: true });
    const selected = await readSelectedImage(file, urls.create, urls.release);
    if (token !== selection.current) return;
    if (!selected.ok) {
      trackEvent("image_selected", {
        tool_id: TOOL_ID,
        tool_type: TOOL_TYPE,
        accepted: false,
        error_code: selected.reason,
        input_size_bucket: fileSizeBucket(file.size),
      });
      setState({
        phase: "select",
        busy: false,
        error:
          selected.reason === "unreadable"
            ? ERROR_COPY.unreadable
            : errorMessageFor(selected.reason),
      });
      return;
    }
    const { image } = selected;
    const formats = encodable ?? (await detectEncodableFormats());
    trackEvent("image_selected", {
      tool_id: TOOL_ID,
      tool_type: TOOL_TYPE,
      accepted: true,
      input_format: image.format,
      input_size_bucket: fileSizeBucket(image.file.size),
      input_megapixel_bucket: megapixelBucket(image.width, image.height),
    });
    job.warmUp();
    setState({
      phase: "configure",
      image,
      settings: {
        choice: defaultChoice,
        customKB: "",
        format: defaultCompressFormat(image, formats),
      },
    });
  };

  const update = (settings: Settings) =>
    setState((current) => (current.phase === "configure" ? { ...current, settings } : current));

  const compress = async () => {
    if (state.phase !== "configure") return;
    const limit = maxBytesFor(state.settings);
    if ("error" in limit) return;
    const { image, settings } = state;
    const request = toCompressJob(
      { width: image.width, height: image.height, byteLength: image.file.size },
      limit.bytes,
      settings.format,
    );
    setState({ phase: "processing", image, settings });
    const eventProps = { tool_id: TOOL_ID, tool_type: TOOL_TYPE, output_format: settings.format };
    trackEvent("processing_started", eventProps);
    const outcome = await job.run(image.file, {
      requirements: request.requirements,
      encoding: request.encoding,
      crop: { mode: "auto" },
    });
    if (!outcome) return;
    if (!outcome.ok) {
      trackJobResult(eventProps, "ERROR", { error_code: outcome.error.code });
      setState({
        phase: "error",
        image,
        settings,
        message: errorMessageFor(outcome.error.code),
        retryable: isRetryable(outcome.error.code),
      });
      return;
    }
    const { result } = outcome;
    // Judged on the actual bytes the user would download.
    const verdict = deriveCompressionOutcome({
      originalBytes: image.file.size,
      maxBytes: limit.bytes,
      outputBytes: result.facts.byteLength,
      validation: result.validation,
    });
    const resultUrl = urls.create(result.blob);
    const resultState = verdict === "SUCCESS" ? "READY" : "INVALID";
    trackEvent("processing_completed", {
      ...eventProps,
      result_state: resultState,
      output_size_bucket: fileSizeBucket(result.facts.byteLength),
      output_megapixel_bucket: megapixelBucket(result.facts.width, result.facts.height),
    });
    trackJobResult(eventProps, resultState, {
      reason_code:
        verdict === "LIMIT_NOT_REACHED"
          ? "COMPRESSION_LIMIT_NOT_REACHED"
          : verdict === "LARGER_THAN_ORIGINAL"
            ? "OUTPUT_LARGER_THAN_ORIGINAL"
            : primaryReasonCode({
                // Size is judged by the outcome above, as in deriveCompressionOutcome.
                checks: result.validation.checks.filter((check) => check.id !== "file-size"),
                outputDpi: result.facts.dpi,
              }),
    });
    setState({
      phase: "result",
      image,
      settings,
      maxBytes: limit.bytes,
      result,
      resultUrl,
      outcome: verdict,
      dimensionsReduced: request.dimensionsReduced,
    });
  };

  const backToSettings = () =>
    setState((current) => {
      if (current.phase !== "result" && current.phase !== "error") return current;
      if (current.phase === "result") urls.release(current.resultUrl);
      return { phase: "configure", image: current.image, settings: current.settings };
    });

  const reset = () => {
    job.cancel();
    selection.current++;
    urls.releaseAll();
    setState({ phase: "select", error: null, busy: false });
  };

  const heading = "text-lg font-semibold outline-none";

  if (!supported) {
    return (
      <section
        className="rounded-xl border border-border p-4"
        data-testid="image-tool"
        data-state="UNSUPPORTED"
      >
        <h2 className={heading}>Your browser can&apos;t run this tool</h2>
        <p className="mt-2 text-muted">{ERROR_COPY.browser}</p>
      </section>
    );
  }

  const uiState = state.phase === "result" ? state.outcome : state.phase.toUpperCase();

  return (
    <section
      aria-label="Image compressor"
      data-testid="image-tool"
      data-state={uiState}
      className="rounded-xl border border-border p-4 shadow-sm sm:p-6"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {state.phase === "processing"
          ? "Compressing your image"
          : state.phase === "result"
            ? state.outcome === "SUCCESS"
              ? "Compressed image ready"
              : "The image could not be compressed as requested"
            : state.phase === "error"
              ? state.message
              : ""}
      </p>

      {state.phase === "select" ? (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="sr-only">
            Choose an image
          </h2>
          <ImageUploader noun="image" onSelect={handleFile} error={state.error} busy={state.busy} />
        </div>
      ) : null}

      {state.phase === "configure"
        ? (() => {
            const { image, settings } = state;
            const limit = maxBytesFor(settings);
            const plan = toCompressJob(
              { width: image.width, height: image.height, byteLength: image.file.size },
              "bytes" in limit ? limit.bytes : DEFAULT_MAX_BYTES,
              settings.format,
            );
            const warning = transparencyWarning(settings.format, image);
            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 ref={headingRef} tabIndex={-1} className={heading}>
                    Compression settings
                  </h2>
                  <button
                    type="button"
                    onClick={reset}
                    className="min-h-11 text-sm font-medium underline"
                  >
                    Change image
                  </button>
                </div>
                <SourceDetails image={image} />

                <fieldset className="space-y-2">
                  <legend className="mb-1 font-semibold">Maximum file size</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[...SIZE_PRESETS, { id: "custom", label: "Custom" }].map((option) => (
                      <RadioOption
                        key={option.id}
                        name="max-size"
                        value={option.id}
                        checked={settings.choice === option.id}
                        onChange={(choice) => update({ ...settings, choice })}
                        label={option.label}
                      />
                    ))}
                  </div>
                  {settings.choice === "custom" ? (
                    <div>
                      <label htmlFor={customId} className="block font-medium">
                        Custom maximum (KB)
                      </label>
                      <input
                        id={customId}
                        type="number"
                        inputMode="numeric"
                        min={10}
                        step={1}
                        value={settings.customKB}
                        onChange={(event) => update({ ...settings, customKB: event.target.value })}
                        aria-invalid={"error" in limit ? true : undefined}
                        aria-describedby={`${customId}-help`}
                        className="mt-1 min-h-11 w-40 rounded-lg border border-border bg-background px-3 text-lg tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none aria-invalid:border-danger"
                      />
                      {"error" in limit && settings.customKB !== "" ? (
                        <p className="mt-1 text-sm font-medium text-danger">{limit.error}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <p id={`${customId}-help`} className="text-sm text-muted">
                    1 KB = 1024 bytes. The result is checked against this limit using its actual
                    file size.
                  </p>
                </fieldset>

                <FormatChoice
                  name="compress-format"
                  formats={COMPRESS_FORMATS}
                  value={settings.format}
                  encodable={encodable}
                  onChange={(format) => update({ ...settings, format: format as CompressFormat })}
                />
                {image.format === "png" ? (
                  <p className="text-sm text-muted">
                    PNG files are compressed by saving them as JPG or WebP, which can reach much
                    smaller sizes.
                  </p>
                ) : null}
                {warning ? <Notice tone="warning">{warning}</Notice> : null}

                <p className="font-medium" data-testid="dimensions-note">
                  {plan.dimensionsReduced
                    ? `Dimensions reduced to ${plan.size.width} × ${plan.size.height} px to stay within the browser's ${(MAX_CANVAS_PIXELS / 1_000_000).toFixed(1)}-megapixel processing limit.`
                    : `Dimensions preserved: ${plan.size.width} × ${plan.size.height} px`}
                </p>
                <p className="text-sm">
                  Need to change image dimensions?{" "}
                  <Link href="/image-resizer" className="font-medium underline underline-offset-2">
                    Use Image Resizer
                  </Link>
                  .
                </p>

                <button
                  type="button"
                  onClick={compress}
                  disabled={"error" in limit}
                  className={primaryButton}
                >
                  Compress Image
                </button>
              </div>
            );
          })()
        : null}

      {state.phase === "processing" ? (
        <div>
          <h2 ref={headingRef} tabIndex={-1} className={heading}>
            Compressing your image
          </h2>
          <p className="text-sm text-muted">This happens on your device.</p>
          <ProcessingProgress stage={job.stage} />
        </div>
      ) : null}

      {state.phase === "result" ? (
        <CompressionResult
          state={state}
          headingRef={headingRef}
          onSettings={backToSettings}
          onReset={reset}
        />
      ) : null}

      {state.phase === "error" ? (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className={heading}>
            Something went wrong
          </h2>
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-4">
            {state.message}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={backToSettings} className={secondaryButton}>
              Change settings
            </button>
            <button type="button" onClick={reset} className={secondaryButton}>
              Choose another image
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const RESULT_HEADINGS: Record<CompressionOutcome, string> = {
  SUCCESS: "✓ Compressed image ready",
  LIMIT_NOT_REACHED: "Could not compress this image below the selected size limit.",
  LARGER_THAN_ORIGINAL: "Output is larger than the original.",
  INVALID: "The result didn't pass the checks.",
};

function CompressionResult({
  state,
  headingRef,
  onSettings,
  onReset,
}: {
  state: Extract<State, { phase: "result" }>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onSettings: () => void;
  onReset: () => void;
}) {
  const { image, result, outcome, maxBytes } = state;
  const before = image.file.size;
  const after = result.facts.byteLength;
  const saved = savedPercent(before, after);
  const success = outcome === "SUCCESS";

  return (
    <div className="space-y-4">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
        data-testid="result-heading"
      >
        {RESULT_HEADINGS[outcome]}
      </h2>

      <dl className="grid grid-cols-3 gap-2 text-center" data-testid="compression-stats">
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-sm text-muted">Before</dt>
          <dd className="font-semibold tabular-nums" data-bytes={before}>
            {formatBytes(before)}
          </dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-sm text-muted">After</dt>
          <dd className="font-semibold tabular-nums" data-bytes={after}>
            {formatBytes(after)}
          </dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-sm text-muted">{saved > 0 ? "Saved" : "Change"}</dt>
          <dd className="font-semibold tabular-nums" data-testid="saved-percent">
            {saved > 0 ? `${saved.toFixed(1)}%` : `+${Math.abs(saved).toFixed(1)}% larger`}
          </dd>
        </div>
      </dl>
      <p className="text-sm">
        Maximum: <span className="font-medium">{formatByteLimit(maxBytes)}</span> (
        {maxBytes.toLocaleString("en-US")} bytes) · Result: {after.toLocaleString("en-US")} bytes
        {result.compression.quality !== null ? ` · Quality ${result.compression.quality}` : ""}
      </p>

      {outcome === "LIMIT_NOT_REACHED" ? (
        <div className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm" role="alert">
          <p>
            The smallest version we could make is {formatBytes(after)} at the lowest quality we
            allow, which is above your {formatByteLimit(maxBytes)} limit. We don&apos;t add noise,
            pad files or change pixels artificially.
          </p>
        </div>
      ) : null}
      {outcome === "LARGER_THAN_ORIGINAL" ? (
        <div
          className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm"
          role="alert"
        >
          <p>
            Your original file ({formatBytes(before)}) is already smaller than anything we could
            make in this format. Keep using your original, or try another format.
          </p>
        </div>
      ) : null}
      {outcome === "INVALID" ? (
        <p className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm" role="alert">
          The processed file failed a check. Please try again or choose different settings.
        </p>
      ) : null}

      <ResultPreview
        stackOnMobile
        finalTitle="Compressed"
        original={{
          url: image.url,
          width: result.source.width,
          height: result.source.height,
          byteLength: before,
          formatLabel: FORMAT_LABELS[image.format],
        }}
        final={{
          url: state.resultUrl,
          width: result.facts.width,
          height: result.facts.height,
          byteLength: after,
          formatLabel: result.facts.format ? FORMAT_LABELS[result.facts.format] : "",
        }}
      />
      {state.dimensionsReduced ? (
        <Notice tone="warning">
          <span data-testid="resized-for-processing">
            This image was resized for processing: {result.source.width} × {result.source.height} px
            is above the browser&apos;s safe processing limit, so the output is {result.facts.width}{" "}
            × {result.facts.height} px.
          </span>
        </Notice>
      ) : null}
      <p className="text-sm text-muted">
        {state.dimensionsReduced ? "" : "Dimensions preserved. "}
        Location and camera details (EXIF) are removed.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        {success ? (
          <DownloadButton
            href={state.resultUrl}
            filename={compressFilename({ name: image.file.name }, state.settings.format)}
            onDownload={() => {
              const props = {
                tool_id: TOOL_ID,
                tool_type: TOOL_TYPE,
                output_format: state.settings.format,
                result_state: "READY",
              };
              trackEvent("download_started", props);
              // Hand-off to the browser, not a confirmed save.
              setTimeout(() => trackEvent("download_completed", props), 0);
            }}
          >
            Download
          </DownloadButton>
        ) : null}
        <button type="button" onClick={onSettings} className={secondaryButton}>
          {outcome === "LIMIT_NOT_REACHED" ? "Choose a larger limit" : "Change settings"}
        </button>
        {outcome === "LIMIT_NOT_REACHED" ? (
          <Link href="/image-resizer" className={secondaryButton}>
            Resize image instead
          </Link>
        ) : null}
        <button type="button" onClick={onReset} className={secondaryButton}>
          Start again
        </button>
      </div>
    </div>
  );
}
