import { FORMAT_LABELS, SUPPORTED_INPUT_FORMATS, type ImageFormat } from "@/lib/image/formats";
import { MAX_INPUT_BYTES } from "@/lib/image/limits";
import type { MetadataKind } from "@/lib/image/jpeg";
import { byteWindowFor, type OutputFacts, type OutputRequirements } from "@/lib/image/pipeline";
import type { ValidationCheck, ValidationReport } from "./types";

const EXPECTED_METADATA = "No personal metadata (EXIF, GPS, camera)";

/** Aspect-ratio tolerance; exact dimensions are checked separately. */
const ASPECT_TOLERANCE = 0.01;

/** Human-readable size using 1 KB = 1024 bytes and 1 MB = 1024 KB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** A byte limit written for people: "500 KB", "1 MB" (1024-based, never rounded down). */
export function formatByteLimit(bytes: number): string {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MB`;
  if (bytes % 1024 === 0) return `${bytes / 1024} KB`;
  return `${bytes.toLocaleString("en-US")} bytes`;
}

const METADATA_LABELS: Readonly<Record<MetadataKind, string>> = {
  exif: "EXIF",
  gps: "GPS location",
  xmp: "XMP",
  icc: "colour profile",
  iptc: "IPTC",
  comment: "comment",
  "jfif-thumbnail": "thumbnail",
  "other-app": "vendor data",
};

function formatList(formats: readonly ImageFormat[]): string {
  return formats.map((format) => FORMAT_LABELS[format]).join(", ");
}

function skipped(id: ValidationCheck["id"], label: string, expected: string): ValidationCheck {
  return { id, label, expected, status: "skipped", actual: null, message: null };
}

/**
 * Validates a produced (or user-supplied) file against output requirements
 * (a preset, or requirements built by a generic tool).
 * Pass `error` when processing failed; remaining checks are then skipped.
 */
export function validateAgainstPreset(
  preset: OutputRequirements,
  facts: OutputFacts | null,
  error?: string,
): ValidationReport {
  const expectedDimensions = `${preset.width} × ${preset.height} px`;
  const expectedRatio = `${preset.width}:${preset.height}`;
  const expectedFormat = formatList(preset.formats);
  const window = byteWindowFor(preset);
  // Presets show the source's own KB wording; runtime limits show exact 1024-based limits.
  const expectedSize = preset.fileSizeBytes
    ? preset.fileSizeBytes.minBytes > 0
      ? `${formatByteLimit(preset.fileSizeBytes.minBytes)}–${formatByteLimit(preset.fileSizeBytes.maxBytes)}`
      : `Up to ${formatByteLimit(preset.fileSizeBytes.maxBytes)}`
    : preset.fileSizeKB
      ? `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`
      : null;
  const minText = preset.fileSizeBytes
    ? formatByteLimit(preset.fileSizeBytes.minBytes)
    : `${preset.fileSizeKB?.min} KB`;
  const maxText = preset.fileSizeBytes
    ? formatByteLimit(preset.fileSizeBytes.maxBytes)
    : `${preset.fileSizeKB?.max} KB`;
  const dpiRange = preset.dpi;
  const expectedDpi = dpiRange ? `${dpiRange.min}–${dpiRange.max} DPI` : null;

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
        ...(expectedSize ? [skipped("file-size", "File size", expectedSize)] : []),
        ...(expectedDpi ? [skipped("dpi", "DPI", expectedDpi)] : []),
        skipped("metadata", "Metadata", EXPECTED_METADATA),
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

  if (window && expectedSize) {
    const tooSmall = facts.byteLength < window.minBytes;
    const tooLarge = facts.byteLength > window.maxBytes;
    checks.push({
      id: "file-size",
      label: "File size",
      expected: expectedSize,
      actual: formatBytes(facts.byteLength),
      status: tooSmall || tooLarge ? "fail" : "pass",
      message: tooSmall
        ? `File is too small; it must be at least ${minText}.`
        : tooLarge
          ? `File is too large; it must be at most ${maxText}.`
          : null,
    });
  }

  if (dpiRange && expectedDpi) {
    const dpiOk =
      facts.dpi !== null &&
      [facts.dpi.x, facts.dpi.y].every((value) => value >= dpiRange.min && value <= dpiRange.max);
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
          : `DPI must be between ${dpiRange.min} and ${dpiRange.max}.`,
    });
  }

  const metadataOk = facts.metadata.length === 0;
  const found = facts.metadata.map((kind) => METADATA_LABELS[kind]).join(", ");
  checks.push({
    id: "metadata",
    label: "Metadata",
    expected: EXPECTED_METADATA,
    actual: metadataOk ? "None" : found,
    status: metadataOk ? "pass" : "fail",
    message: metadataOk
      ? null
      : `File still contains personal or extra metadata (${found}). Process it again to remove it.`,
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
