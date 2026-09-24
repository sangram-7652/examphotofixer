/**
 * Image Compressor settings → engine request, and outcome decided from the
 * ACTUAL encoded bytes. Byte definition: 1 KB = 1024 bytes, 1 MB = 1024 KB.
 */

import type { Size } from "@/lib/image/geometry";
import { MAX_INPUT_BYTES } from "@/lib/image/limits";
import type { EncodingOptions, OutputFormat, OutputRequirements } from "@/lib/image/pipeline";
import type { ValidationReport } from "@/lib/validation/types";
import {
  FORMAT_EXTENSIONS,
  KIB,
  MIB,
  fitWithinEngineLimits,
  safeBaseName,
  type SourceImage,
} from "./common";

/** Size limits need a quality setting, so only lossy formats are offered. */
export const COMPRESS_FORMATS = ["jpeg", "webp"] as const satisfies readonly OutputFormat[];
export type CompressFormat = (typeof COMPRESS_FORMATS)[number];

export const SIZE_PRESETS = [
  { id: "100kb", label: "100 KB", bytes: 100 * KIB },
  { id: "200kb", label: "200 KB", bytes: 200 * KIB },
  { id: "500kb", label: "500 KB", bytes: 500 * KIB },
  { id: "1mb", label: "1 MB", bytes: MIB },
] as const;

export const DEFAULT_MAX_BYTES = 200 * KIB;
export const MIN_CUSTOM_KB = 10;
export const MAX_CUSTOM_KB = Math.floor(MAX_INPUT_BYTES / KIB);

/** Parses a custom maximum in KB (whole number). Returns bytes or an error message. */
export function parseCustomKB(input: string): { bytes: number } | { error: string } {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return { error: "Enter a whole number of KB." };
  const kb = Number(trimmed);
  if (kb < MIN_CUSTOM_KB) return { error: `The maximum must be at least ${MIN_CUSTOM_KB} KB.` };
  if (kb > MAX_CUSTOM_KB) {
    return { error: `The maximum can be at most ${MAX_CUSTOM_KB.toLocaleString("en-US")} KB.` };
  }
  return { bytes: kb * KIB };
}

export function defaultCompressFormat(
  source: Pick<SourceImage, "format" | "mayHaveTransparency">,
  encodable: Record<OutputFormat, boolean>,
): CompressFormat {
  const wantsWebp =
    source.format === "webp" || (source.format === "png" && source.mayHaveTransparency);
  return wantsWebp && encodable.webp ? "webp" : "jpeg";
}

/**
 * Runtime requirements: original (oriented) dimensions — reduced only if they
 * exceed the engine's browser limits — and a byte window capped at both the
 * chosen maximum and the original size, so we never aim for a bigger file.
 */
export function toCompressJob(
  source: Pick<SourceImage, "width" | "height" | "byteLength">,
  maxBytes: number,
  format: CompressFormat,
): {
  requirements: OutputRequirements;
  encoding: EncodingOptions;
  size: Size;
  dimensionsReduced: boolean;
} {
  const { size, reduced } = fitWithinEngineLimits({ width: source.width, height: source.height });
  return {
    size,
    dimensionsReduced: reduced,
    requirements: {
      id: "image-compressor",
      ...size,
      fileSizeKB: null,
      fileSizeBytes: { minBytes: 0, maxBytes: Math.max(1, Math.min(maxBytes, source.byteLength)) },
      dpi: null,
      formats: [format],
    },
    encoding: { format },
  };
}

export type CompressionOutcome =
  "SUCCESS" | "LIMIT_NOT_REACHED" | "LARGER_THAN_ORIGINAL" | "INVALID";

/**
 * Decided only from actual encoded bytes: success requires
 * `outputBytes <= maxBytes` and `outputBytes < originalBytes`.
 */
export function deriveCompressionOutcome(input: {
  originalBytes: number;
  maxBytes: number;
  outputBytes: number;
  validation: ValidationReport;
}): CompressionOutcome {
  if (input.outputBytes > input.maxBytes) return "LIMIT_NOT_REACHED";
  if (input.outputBytes >= input.originalBytes) return "LARGER_THAN_ORIGINAL";
  // The file-size check uses the capped window; the outcome above already covers size.
  const otherChecks = input.validation.checks.filter((check) => check.id !== "file-size");
  return otherChecks.every((check) => check.status === "pass") ? "SUCCESS" : "INVALID";
}

/** ((original − output) ÷ original) × 100, from actual bytes. Negative when larger. */
export function savedPercent(originalBytes: number, outputBytes: number): number {
  return ((originalBytes - outputBytes) / originalBytes) * 100;
}

/** e.g. "holiday-compressed.jpg", or "compressed-image.jpg" without a usable name. */
export function compressFilename(source: Pick<SourceImage, "name">, format: OutputFormat): string {
  const base = safeBaseName(source.name);
  return `${base ? `${base}-compressed` : "compressed-image"}.${FORMAT_EXTENSIONS[format]}`;
}
