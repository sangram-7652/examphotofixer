import { FORMAT_LABELS, SUPPORTED_INPUT_FORMATS, type ImageFormat } from "@/lib/image/formats";
import { MAX_INPUT_BYTES } from "@/lib/image/limits";
import type { OutputFacts } from "@/lib/image/pipeline";
import { kbRangeToByteWindow } from "@/lib/image/size-target";
import type { ImagePreset } from "@/lib/presets/types";
import type { ValidationCheck, ValidationReport } from "./types";

/** Aspect-ratio tolerance; exact dimensions are checked separately. */
const ASPECT_TOLERANCE = 0.01;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatList(formats: readonly ImageFormat[]): string {
  return formats.map((format) => FORMAT_LABELS[format]).join(", ");
}

function skipped(id: ValidationCheck["id"], label: string, expected: string): ValidationCheck {
  return { id, label, expected, status: "skipped", actual: null, message: null };
}

/**
 * Validates a produced (or user-supplied) file against a preset.
 * Pass `error` when processing failed; remaining checks are then skipped.
 */
export function validateAgainstPreset(
  preset: ImagePreset,
  facts: OutputFacts | null,
  error?: string,
): ValidationReport {
  const expectedDimensions = `${preset.width} × ${preset.height} px`;
  const expectedRatio = `${preset.width}:${preset.height}`;
  const expectedFormat = formatList(preset.formats);
  const expectedSize = `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`;
  const expectedDpi = `${preset.dpi.min}–${preset.dpi.max} DPI`;

  if (!facts || error) {
    return {
      presetId: preset.id,
      ready: false,
      checks: [
        {
          id: "processing",
          label: "Processing",
          expected: "File processed successfully",
          status: "fail",
          actual: null,
          message: error ?? "The image could not be processed. Try a different JPG or PNG file.",
        },
        skipped("dimensions", "Dimensions", expectedDimensions),
        skipped("aspect-ratio", "Aspect ratio", expectedRatio),
        skipped("format", "Format", expectedFormat),
        skipped("file-size", "File size", expectedSize),
        skipped("dpi", "DPI", expectedDpi),
      ],
    };
  }

  const checks: ValidationCheck[] = [];

  const dimensionsOk = facts.width === preset.width && facts.height === preset.height;
  checks.push({
    id: "dimensions",
    label: "Dimensions",
    expected: expectedDimensions,
    actual: `${facts.width} × ${facts.height} px`,
    status: dimensionsOk ? "pass" : "fail",
    message: dimensionsOk
      ? null
      : `Image must be exactly ${expectedDimensions}; it is ${facts.width} × ${facts.height} px.`,
  });

  const ratio = facts.height > 0 ? facts.width / facts.height : 0;
  const targetRatio = preset.width / preset.height;
  const ratioOk = Math.abs(ratio - targetRatio) / targetRatio <= ASPECT_TOLERANCE;
  checks.push({
    id: "aspect-ratio",
    label: "Aspect ratio",
    expected: expectedRatio,
    actual: ratio > 0 ? ratio.toFixed(3) : null,
    status: ratioOk ? "pass" : "fail",
    message: ratioOk ? null : "Image shape does not match. Crop it to the required shape.",
  });

  const formatOk =
    facts.format !== null && (preset.formats as readonly string[]).includes(facts.format);
  checks.push({
    id: "format",
    label: "Format",
    expected: expectedFormat,
    actual: facts.format ? FORMAT_LABELS[facts.format] : "Unknown",
    status: formatOk ? "pass" : "fail",
    message: formatOk ? null : `File must be ${expectedFormat}.`,
  });

  const window = kbRangeToByteWindow(preset.fileSizeKB);
  const tooSmall = facts.byteLength < window.minBytes;
  const tooLarge = facts.byteLength > window.maxBytes;
  checks.push({
    id: "file-size",
    label: "File size",
    expected: expectedSize,
    actual: formatBytes(facts.byteLength),
    status: tooSmall || tooLarge ? "fail" : "pass",
    message: tooSmall
      ? `File is too small; it must be at least ${preset.fileSizeKB.min} KB.`
      : tooLarge
        ? `File is too large; it must be at most ${preset.fileSizeKB.max} KB.`
        : null,
  });

  const dpiOk =
    facts.dpi !== null &&
    [facts.dpi.x, facts.dpi.y].every((value) => value >= preset.dpi.min && value <= preset.dpi.max);
  checks.push({
    id: "dpi",
    label: "DPI",
    expected: expectedDpi,
    actual: facts.dpi
      ? facts.dpi.x === facts.dpi.y
        ? `${facts.dpi.x} DPI`
        : `${facts.dpi.x} × ${facts.dpi.y} DPI`
      : "Not set",
    status: dpiOk ? "pass" : "fail",
    message: dpiOk
      ? null
      : facts.dpi === null
        ? `File has no DPI information; it must be ${expectedDpi}.`
        : `DPI must be between ${preset.dpi.min} and ${preset.dpi.max}.`,
  });

  return {
    presetId: preset.id,
    ready: checks.every((check) => check.status === "pass"),
    checks,
  };
}

export type InputRejection = "empty-file" | "file-too-large" | "unsupported-format";

/** Cheap pre-flight check on a user's input before decoding. */
export function checkInputFile(input: {
  byteLength: number;
  format: ImageFormat | null;
}): InputRejection | null {
  if (input.byteLength === 0) return "empty-file";
  if (input.byteLength > MAX_INPUT_BYTES) return "file-too-large";
  if (input.format === null || !SUPPORTED_INPUT_FORMATS.includes(input.format)) {
    return "unsupported-format";
  }
  return null;
}
