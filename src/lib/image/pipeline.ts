/**
 * Image pipeline contract shared by the engine, the worker protocol, validation
 * and tests.
 *
 * INPUT → decode → EXIF orientation → crop → resize → transparency → JPEG encode
 *       → size-window compression → DPI → strip metadata → validate → Blob + metadata
 */

import type { NumericRange } from "@/lib/presets/types";
import type { ImageFormat } from "./formats";
import type { MetadataKind } from "./jpeg";
import { kbRangeToByteWindow, type ByteWindow } from "./size-target";

/** Progress stages, in the order the worker reports them. */
export const PROGRESS_STAGES = [
  "loading",
  "orientation",
  "cropping",
  "resizing",
  "encoding",
  "dpi",
  "metadata",
  "validation",
  "complete",
] as const;

export type ProgressStage = (typeof PROGRESS_STAGES)[number];

/** Stage in which an error happened (anything but `complete`), or the worker transport. */
export type ProcessingStage = Exclude<ProgressStage, "complete"> | "worker";

export type ProcessingErrorCode =
  | "invalid-request"
  | "empty-file"
  | "file-too-large"
  | "unsupported-format"
  | "animated-image"
  | "corrupt-file"
  | "image-too-large"
  | "decode-failed"
  | "encode-failed"
  | "unsupported-output-format"
  | "unsupported-browser"
  | "worker-failed"
  | "timeout"
  | "aborted"
  | "internal-error";

/** User-facing explanation per error code. The UI may override wording. */
export const PROCESSING_ERROR_MESSAGES: Readonly<Record<ProcessingErrorCode, string>> = {
  "invalid-request": "The tool was configured incorrectly. Please reload the page.",
  "empty-file": "This file is empty. Choose a different photo.",
  "file-too-large": "This file is too large. Choose a photo under 25 MB.",
  "unsupported-format": "This file type isn't supported. Use a JPG, PNG or WebP image.",
  "animated-image": "Animated images aren't supported. Use a still JPG or PNG photo.",
  "corrupt-file": "This image file is damaged or incomplete. Try saving or downloading it again.",
  "image-too-large": "This image has too many pixels to process safely. Use a smaller photo.",
  "decode-failed": "This image couldn't be opened. Try a different JPG or PNG file.",
  "encode-failed": "The image couldn't be saved as JPG in this browser. Try another browser.",
  "unsupported-output-format":
    "This browser can't save images in the selected format. Choose another format.",
  "unsupported-browser": "Your browser can't process images here. Update it or try Chrome.",
  "worker-failed": "Processing stopped unexpectedly. Please try again.",
  timeout: "Processing took too long. Try a smaller photo.",
  aborted: "Processing was cancelled.",
  "internal-error": "Something went wrong while processing. Please try again.",
};

export class ImageProcessingError extends Error {
  readonly code: ProcessingErrorCode;
  readonly stage: ProcessingStage;

  constructor(code: ProcessingErrorCode, stage: ProcessingStage, message?: string) {
    super(message ?? PROCESSING_ERROR_MESSAGES[code]);
    this.name = "ImageProcessingError";
    this.code = code;
    this.stage = stage;
  }
}

/** Formats the engine can write. JPEG is always available; WebP depends on the browser. */
export type OutputFormat = "jpeg" | "png" | "webp";

export const OUTPUT_MIME_TYPES: Readonly<Record<OutputFormat, string>> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * What an output file must satisfy. Two sources build this shape:
 * verified presets (e.g. CCC) and runtime settings from generic tools.
 * No exam-specific values here. `null` means "not required" and the
 * corresponding validation check is omitted.
 */
export interface OutputRequirements {
  id: string;
  width: number;
  height: number;
  /** KB range exactly as written by a source (presets); converted conservatively. */
  fileSizeKB: NumericRange | null;
  /** Exact byte limits (generic tools, 1 KB = 1024 bytes). Takes precedence over `fileSizeKB`. */
  fileSizeBytes?: ByteWindow | null;
  dpi: NumericRange | null;
  formats: readonly OutputFormat[];
}

/** How to encode. Defaults: the first allowed format; quality found by the size search or 92. */
export interface EncodingOptions {
  format: OutputFormat;
  /** 1–100 for JPEG/WebP when there is no size limit. Ignored for PNG (lossless). */
  quality?: number;
}

/** The byte window a requirement set implies, or `null` when file size is unconstrained. */
export function byteWindowFor(requirements: OutputRequirements): ByteWindow | null {
  if (requirements.fileSizeBytes) return requirements.fileSizeBytes;
  return requirements.fileSizeKB ? kbRangeToByteWindow(requirements.fileSizeKB) : null;
}

/** Facts read back from the final encoded bytes; consumed by validation. */
export interface OutputFacts {
  width: number;
  height: number;
  byteLength: number;
  format: ImageFormat | null;
  /** `null` when the file carries no DPI metadata. */
  dpi: { x: number; y: number } | null;
  /** Non-essential metadata found in the file; must be empty for our outputs. */
  metadata: readonly MetadataKind[];
}
