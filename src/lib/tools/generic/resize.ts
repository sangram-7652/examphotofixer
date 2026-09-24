/**
 * Image Resizer settings → engine request. Pure; the UI only edits settings and
 * calls `toResizeJob` when the user presses "Resize Image".
 */

import type { Size } from "@/lib/image/geometry";
import { MAX_CANVAS_PIXELS, MAX_OUTPUT_SIDE } from "@/lib/image/limits";
import type { EncodingOptions, OutputFormat, OutputRequirements } from "@/lib/image/pipeline";
import { FORMAT_EXTENSIONS, fitWithinEngineLimits, safeBaseName, type SourceImage } from "./common";

export type ResizeMode = "crop" | "fit";

export interface ResizeSettings {
  width: number;
  height: number;
  lockAspect: boolean;
  /** Width ÷ height used while locked: the original's, until the user unlocks and changes it. */
  aspect: number;
  mode: ResizeMode;
  format: OutputFormat;
  /** 1–100, used for JPEG and WebP only. */
  quality: number;
}

export const DEFAULT_RESIZE_QUALITY = 85;
/** Default size: the original, scaled down if its longer side exceeds this. */
export const DEFAULT_MAX_SIDE = 1920;

export function defaultResizeSettings(source: Size, format: OutputFormat): ResizeSettings {
  const scale = Math.min(1, DEFAULT_MAX_SIDE / Math.max(source.width, source.height));
  const fitted = fitWithinEngineLimits({
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }).size;
  return {
    ...fitted,
    lockAspect: true,
    aspect: source.width / source.height,
    mode: "crop",
    format,
    quality: DEFAULT_RESIZE_QUALITY,
  };
}

const toSide = (value: number) => Math.max(1, Math.round(value));

/** Sets width; when locked, height follows the locked aspect ratio. */
export function setWidth(settings: ResizeSettings, width: number): ResizeSettings {
  if (!Number.isFinite(width)) return { ...settings, width };
  return settings.lockAspect
    ? { ...settings, width, height: toSide(width / settings.aspect) }
    : { ...settings, width };
}

/** Sets height; when locked, width follows the locked aspect ratio. */
export function setHeight(settings: ResizeSettings, height: number): ResizeSettings {
  if (!Number.isFinite(height)) return { ...settings, height };
  return settings.lockAspect
    ? { ...settings, height, width: toSide(height * settings.aspect) }
    : { ...settings, height };
}

/** Locking keeps the current proportions (the user may have changed them while unlocked). */
export function setLockAspect(settings: ResizeSettings, lockAspect: boolean): ResizeSettings {
  const valid = settings.width > 0 && settings.height > 0;
  return {
    ...settings,
    lockAspect,
    aspect: lockAspect && valid ? settings.width / settings.height : settings.aspect,
  };
}

export interface ResizeErrors {
  width?: string;
  height?: string;
  size?: string;
  quality?: string;
}

function sideError(value: number, name: string): string | undefined {
  if (!Number.isFinite(value) || !Number.isInteger(value))
    return `Enter a whole number for ${name}.`;
  if (value < 1) return `${name[0].toUpperCase()}${name.slice(1)} must be at least 1 px.`;
  if (value > MAX_OUTPUT_SIDE) {
    return `${name[0].toUpperCase()}${name.slice(1)} can be at most ${MAX_OUTPUT_SIDE.toLocaleString("en-US")} px.`;
  }
  return undefined;
}

/** Returns `null` when the settings can be processed. */
export function validateResizeSettings(settings: ResizeSettings): ResizeErrors | null {
  const errors: ResizeErrors = {
    width: sideError(settings.width, "width"),
    height: sideError(settings.height, "height"),
  };
  if (!errors.width && !errors.height && settings.width * settings.height > MAX_CANVAS_PIXELS) {
    errors.size = `Width × height can be at most ${(MAX_CANVAS_PIXELS / 1_000_000).toFixed(1)} megapixels in the browser.`;
  }
  if (
    settings.format !== "png" &&
    !(Number.isInteger(settings.quality) && settings.quality >= 1 && settings.quality <= 100)
  ) {
    errors.quality = "Quality must be between 1 and 100.";
  }
  return Object.values(errors).some(Boolean) ? errors : null;
}

/** Largest size with the source's proportions that fits inside `box` (may upscale). */
export function fitInside(source: Size, box: Size): Size {
  const scale = Math.min(box.width / source.width, box.height / source.height);
  return {
    width: Math.min(box.width, toSide(source.width * scale)),
    height: Math.min(box.height, toSide(source.height * scale)),
  };
}

/** Exact output size: the requested box (crop) or the fitted size (fit). */
export function resizeOutputSize(settings: ResizeSettings, source: Size): Size {
  const box = { width: settings.width, height: settings.height };
  return settings.mode === "crop" ? box : fitInside(source, box);
}

/**
 * Runtime requirements for the engine. Fit mode asks for the fitted size, so
 * the whole image is kept without padding or an invented background.
 */
export function toResizeJob(
  settings: ResizeSettings,
  source: Size,
): { requirements: OutputRequirements; encoding: EncodingOptions; size: Size } {
  const size = resizeOutputSize(settings, source);
  return {
    size,
    requirements: {
      id: "image-resizer",
      ...size,
      fileSizeKB: null,
      fileSizeBytes: null,
      dpi: null,
      formats: [settings.format],
    },
    encoding: {
      format: settings.format,
      ...(settings.format === "png" ? {} : { quality: settings.quality }),
    },
  };
}

/** e.g. "holiday-resized-800x600.jpg", or "resized-800x600.jpg" without a usable name. */
export function resizeFilename(
  source: Pick<SourceImage, "name">,
  size: Size,
  format: OutputFormat,
): string {
  const base = safeBaseName(source.name);
  const stem = `resized-${size.width}x${size.height}`;
  return `${base ? `${base}-${stem}` : stem}.${FORMAT_EXTENSIONS[format]}`;
}
