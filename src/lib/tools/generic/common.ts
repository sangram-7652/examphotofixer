/**
 * Shared helpers for generic (user-configured) tools. These build runtime
 * requirements for the same engine the verified presets use; they never touch
 * the preset system.
 */

import type { ImageFormat } from "@/lib/image/formats";
import type { Size } from "@/lib/image/geometry";
import { MAX_CANVAS_PIXELS, MAX_OUTPUT_SIDE } from "@/lib/image/limits";
import type { OutputFormat } from "@/lib/image/pipeline";

/** One consistent byte definition for generic tools: 1 KB = 1024 bytes, 1 MB = 1024 KB. */
export const KIB = 1024;
export const MIB = 1024 * KIB;

export const FORMAT_EXTENSIONS: Readonly<Record<OutputFormat, string>> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export const OUTPUT_FORMAT_LABELS: Readonly<Record<OutputFormat, string>> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
};

/** Details of the selected image, read in the browser (never sent anywhere). */
export interface SourceImage {
  name: string;
  byteLength: number;
  format: ImageFormat;
  /** Visual (EXIF-oriented) size. */
  width: number;
  height: number;
  /** Header declares an alpha channel. */
  mayHaveTransparency: boolean;
}

/**
 * Filename-safe base from the user's filename: ASCII letters, digits, "-" and
 * "_" only, at most 40 characters. `null` if nothing usable remains.
 */
export function safeBaseName(filename: string): string | null {
  const leaf = filename.split(/[\\/]/).pop() ?? "";
  const base = leaf.replace(/(?<=.)\.[^.]*$/, "");
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40)
    .replace(/[-_]+$/g, "");
  return cleaned.length > 0 ? cleaned.toLowerCase() : null;
}

/**
 * Largest size with the same aspect ratio that the engine accepts
 * (≤ MAX_OUTPUT_SIDE per side, ≤ MAX_CANVAS_PIXELS in total).
 */
export function fitWithinEngineLimits(size: Size): { size: Size; reduced: boolean } {
  const scale = Math.min(
    1,
    MAX_OUTPUT_SIDE / Math.max(size.width, size.height),
    Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height)),
  );
  if (scale >= 1) return { size, reduced: false };
  return {
    size: {
      width: Math.max(1, Math.floor(size.width * scale)),
      height: Math.max(1, Math.floor(size.height * scale)),
    },
    reduced: true,
  };
}

/** Sensible default output format for an input. */
export function defaultOutputFormat(
  source: Pick<SourceImage, "format" | "mayHaveTransparency">,
  encodable: Record<OutputFormat, boolean>,
  allowed: readonly OutputFormat[],
): OutputFormat {
  const prefer: OutputFormat[] =
    source.format === "png"
      ? source.mayHaveTransparency
        ? ["png", "webp", "jpeg"]
        : ["png", "jpeg"]
      : source.format === "webp"
        ? ["webp", "png", "jpeg"]
        : ["jpeg"];
  return prefer.find((format) => allowed.includes(format) && encodable[format]) ?? "jpeg";
}

export function transparencyWarning(
  format: OutputFormat,
  source: Pick<SourceImage, "mayHaveTransparency">,
): string | null {
  return format === "jpeg" && source.mayHaveTransparency
    ? "JPG can't store transparency. Any transparent areas will be filled with white."
    : null;
}
