"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { fileSizeBucket, megapixelBucket, trackEvent } from "@/lib/analytics";
import { primaryReasonCode } from "@/lib/analytics/reasons";
import { trackJobResult } from "@/lib/analytics/tool-events";
import { FORMAT_LABELS } from "@/lib/image/formats";
import type { OutputFormat } from "@/lib/image/pipeline";
import {
  detectEncodableFormats,
  isImageProcessingSupported,
  type EncodableFormats,
} from "@/lib/image/support";
import type { ImageProcessingResult } from "@/lib/image/worker/protocol";
import { INITIAL_CROP, type ViewportCrop } from "@/lib/tools/cropper";
import { ERROR_COPY, errorMessageFor, isRetryable } from "@/lib/tools/error-copy";
import { defaultOutputFormat, transparencyWarning } from "@/lib/tools/generic/common";
import {
  defaultResizeSettings,
  resizeFilename,
  resizeOutputSize,
  setHeight,
  setLockAspect,
  setWidth,
  toResizeJob,
  validateResizeSettings,
  type ResizeSettings,
} from "@/lib/tools/generic/resize";
import { buildChecklist } from "@/lib/tools/result-state";
import { Cropper } from "../Cropper";
import { DownloadButton } from "../DownloadButton";
import { ImageUploader } from "../ImageUploader";
import { ProcessingProgress } from "../ProcessingProgress";
import { ResultPreview } from "../ResultPreview";
import { ValidationChecklist } from "../ValidationChecklist";
import { readSelectedImage, useImageJob, useObjectUrls, type SelectedImage } from "../image-job";
import {
  FormatChoice,
  Notice,
  QualitySlider,
  RadioOption,
  SourceDetails,
  primaryButton,
  secondaryButton,
} from "./SettingsParts";

const TOOL_ID = "image-resizer";
const TOOL_TYPE = "generic-resize";
const FORMATS: readonly OutputFormat[] = ["jpeg", "png", "webp"];
const noopSubscribe = () => () => {};

type State =
  | { phase: "select"; error: string | null; busy: boolean }
  | { phase: "configure"; image: SelectedImage; settings: ResizeSettings; crop: ViewportCrop }
  | { phase: "processing"; image: SelectedImage; settings: ResizeSettings; crop: ViewportCrop }
  | {
      phase: "result";
      image: SelectedImage;
      settings: ResizeSettings;
      crop: ViewportCrop;
      result: ImageProcessingResult;
      resultUrl: string;
    }
  | {
      phase: "error";
      image: SelectedImage;
      settings: ResizeSettings;
      crop: ViewportCrop;
      message: string;
      retryable: boolean;
    };

function NumberField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex-1">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          step={1}
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-lg tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none aria-invalid:border-danger"
        />
        <span className="text-muted">px</span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Generic Image Resizer: user-defined runtime requirements, processed by the
 * same engine as the verified presets. Nothing is processed until "Resize Image".
 */
export function ImageResizerTool() {
  const [state, setState] = useState<State>({ phase: "select", error: null, busy: false });
  const [encodable, setEncodable] = useState<EncodableFormats | null>(null);
  const supported = useSyncExternalStore(noopSubscribe, isImageProcessingSupported, () => true);
  const urls = useObjectUrls();
  const job = useImageJob();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(state.phase);
  const selection = useRef(0);

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
      settings: defaultResizeSettings(image, defaultOutputFormat(image, formats, FORMATS)),
      crop: INITIAL_CROP,
    });
  };

  const update = (settings: ResizeSettings) =>
    setState((current) => (current.phase === "configure" ? { ...current, settings } : current));

  const resize = async () => {
    if (state.phase !== "configure" && state.phase !== "error") return;
    if (validateResizeSettings(state.settings)) return;
    const { image, settings, crop } = state;
    const request = toResizeJob(settings, image);
    setState({ phase: "processing", image, settings, crop });
    const eventProps = { tool_id: TOOL_ID, tool_type: TOOL_TYPE, output_format: settings.format };
    trackEvent("processing_started", eventProps);
    const outcome = await job.run(image.file, {
      requirements: request.requirements,
      encoding: request.encoding,
      crop: settings.mode === "crop" ? crop : { mode: "auto" },
    });
    if (!outcome) return;
    if (!outcome.ok) {
      trackJobResult(eventProps, "ERROR", { error_code: outcome.error.code });
      setState({
        phase: "error",
        image,
        settings,
        crop,
        message: errorMessageFor(outcome.error.code),
        retryable: isRetryable(outcome.error.code),
      });
      return;
    }
    const resultUrl = urls.create(outcome.result.blob);
    const { facts, validation } = outcome.result;
    const resultState = validation.ready ? "READY" : "INVALID";
    trackEvent("processing_completed", {
      ...eventProps,
      result_state: resultState,
      output_size_bucket: fileSizeBucket(facts.byteLength),
      output_megapixel_bucket: megapixelBucket(facts.width, facts.height),
    });
    trackJobResult(eventProps, resultState, {
      reason_code: primaryReasonCode({ checks: validation.checks, outputDpi: facts.dpi }),
    });
    setState({ phase: "result", image, settings, crop, result: outcome.result, resultUrl });
  };

  const backToSettings = () =>
    setState((current) => {
      if (current.phase !== "result" && current.phase !== "error") return current;
      if (current.phase === "result") urls.release(current.resultUrl);
      return {
        phase: "configure",
        image: current.image,
        settings: current.settings,
        crop: current.crop,
      };
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

  const uiState =
    state.phase === "result"
      ? state.result.validation.ready
        ? "READY"
        : "INVALID"
      : state.phase.toUpperCase();

  return (
    <section
      aria-label="Image resizer"
      data-testid="image-tool"
      data-state={uiState}
      className="rounded-xl border border-border p-4 shadow-sm sm:p-6"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {state.phase === "processing"
          ? "Resizing your image"
          : state.phase === "result"
            ? "Resized image ready"
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

      {state.phase === "configure" ? (
        <ResizeSettingsForm
          state={state}
          encodable={encodable}
          headingRef={headingRef}
          onChange={update}
          onCrop={(crop) =>
            setState((current) => (current.phase === "configure" ? { ...current, crop } : current))
          }
          onResize={resize}
          onReset={reset}
        />
      ) : null}

      {state.phase === "processing" ? (
        <div>
          <h2 ref={headingRef} tabIndex={-1} className={heading}>
            Resizing your image
          </h2>
          <p className="text-sm text-muted">This happens on your device.</p>
          <ProcessingProgress stage={job.stage} />
        </div>
      ) : null}

      {state.phase === "result" ? (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className={heading} data-testid="result-heading">
            {state.result.validation.ready
              ? "✓ Resized image ready"
              : "✕ The result didn't pass the checks"}
          </h2>
          <ValidationChecklist items={buildChecklist(state.result)} />
          <ResultPreview
            stackOnMobile
            finalTitle="Result"
            original={{
              url: state.image.url,
              width: state.result.source.width,
              height: state.result.source.height,
              byteLength: state.image.file.size,
              formatLabel: FORMAT_LABELS[state.image.format],
            }}
            final={{
              url: state.resultUrl,
              width: state.result.facts.width,
              height: state.result.facts.height,
              byteLength: state.result.facts.byteLength,
              formatLabel: state.result.facts.format
                ? FORMAT_LABELS[state.result.facts.format]
                : "",
            }}
          />
          <p className="text-sm text-muted">
            Location and camera details (EXIF) are not included in the resized file.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {state.result.validation.ready ? (
              <DownloadButton
                href={state.resultUrl}
                filename={resizeFilename(
                  { name: state.image.file.name },
                  { width: state.result.facts.width, height: state.result.facts.height },
                  state.settings.format,
                )}
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
            <button type="button" onClick={backToSettings} className={secondaryButton}>
              Change settings
            </button>
            <button type="button" onClick={reset} className={secondaryButton}>
              Start again
            </button>
          </div>
        </div>
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

function ResizeSettingsForm({
  state,
  encodable,
  headingRef,
  onChange,
  onCrop,
  onResize,
  onReset,
}: {
  state: Extract<State, { phase: "configure" }>;
  encodable: EncodableFormats | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onChange: (settings: ResizeSettings) => void;
  onCrop: (crop: ViewportCrop) => void;
  onResize: () => void;
  onReset: () => void;
}) {
  const { image, settings, crop } = state;
  const errors = validateResizeSettings(settings);
  const lockId = useId();
  const output = errors ? null : resizeOutputSize(settings, image);
  const warning = transparencyWarning(settings.format, image);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          Resize settings
        </h2>
        <button type="button" onClick={onReset} className="min-h-11 text-sm font-medium underline">
          Change image
        </button>
      </div>
      <SourceDetails image={image} />

      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">New size</legend>
        <div className="flex gap-3">
          <NumberField
            label="Width"
            value={settings.width}
            error={errors?.width}
            onChange={(width) => onChange(setWidth(settings, width))}
          />
          <NumberField
            label="Height"
            value={settings.height}
            error={errors?.height}
            onChange={(height) => onChange(setHeight(settings, height))}
          />
        </div>
        {errors?.size ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {errors.size}
          </p>
        ) : null}
        <div className="flex min-h-11 items-center gap-3">
          <input
            id={lockId}
            type="checkbox"
            checked={settings.lockAspect}
            onChange={(event) => onChange(setLockAspect(settings, event.target.checked))}
            className="size-5 accent-brand"
          />
          <label htmlFor={lockId} className="font-medium">
            Lock aspect ratio
          </label>
        </div>
        {!settings.lockAspect ? (
          <Notice tone="info">
            Width and height are independent. Your image is never stretched: “Crop” trims the edges
            to the new shape, and “Fit” keeps the whole image, so one side may come out smaller.
          </Notice>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">Crop or fit</legend>
        <RadioOption
          name="resize-mode"
          value="crop"
          checked={settings.mode === "crop"}
          onChange={() => onChange({ ...settings, mode: "crop" })}
          label="Crop to exact dimensions"
          description="The output is exactly the size you enter. Anything outside the frame is trimmed."
        />
        <RadioOption
          name="resize-mode"
          value="fit"
          checked={settings.mode === "fit"}
          onChange={() => onChange({ ...settings, mode: "fit" })}
          label="Fit inside dimensions"
          description="The whole image is kept and scaled to fit inside the size you enter. No background is added."
        />
      </fieldset>

      {settings.mode === "crop" && !errors ? (
        <Cropper
          imageUrl={image.url}
          imageSize={{ width: image.width, height: image.height }}
          target={{ width: settings.width, height: settings.height }}
          value={crop}
          onChange={onCrop}
          label="Crop area"
        />
      ) : null}

      {output ? (
        <p className="font-medium" data-testid="output-size">
          Output: {output.width} × {output.height} px
        </p>
      ) : null}

      <FormatChoice
        name="resize-format"
        formats={FORMATS}
        value={settings.format}
        encodable={encodable}
        onChange={(format) => onChange({ ...settings, format })}
      />
      {warning ? <Notice tone="warning">{warning}</Notice> : null}
      {settings.format === "png" ? (
        <p className="text-sm text-muted">
          PNG keeps transparency and doesn&apos;t use a quality setting.
        </p>
      ) : (
        <QualitySlider
          value={settings.quality}
          onChange={(quality) => onChange({ ...settings, quality })}
        />
      )}

      <button type="button" onClick={onResize} disabled={errors !== null} className={primaryButton}>
        Resize Image
      </button>
    </div>
  );
}
