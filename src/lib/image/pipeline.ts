/**
 * Image pipeline contract. Implementation is the next phase; this file fixes
 * the stage order and error vocabulary so UI, validation and tests agree.
 *
 * INPUT → load → read metadata → EXIF orientation → target aspect → crop →
 * resize → JPEG encode → compress to size window → DPI metadata → validate → download
 */

import type { FocusPoint, Rect } from "./geometry";
import type { ImageFormat } from "./formats";

export const PIPELINE_STAGES = [
  "load",
  "read-metadata",
  "orient",
  "crop",
  "resize",
  "encode",
  "compress",
  "write-dpi",
  "validate",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type ProcessingErrorCode =
  | "empty-file"
  | "file-too-large"
  | "unsupported-format"
  | "decode-failed"
  | "image-too-large"
  | "size-target-unreachable"
  | "encode-failed";

export class ImageProcessingError extends Error {
  readonly code: ProcessingErrorCode;
  readonly stage: PipelineStage;

  constructor(code: ProcessingErrorCode, stage: PipelineStage, message: string) {
    super(message);
    this.name = "ImageProcessingError";
    this.code = code;
    this.stage = stage;
  }
}

export interface ProcessOptions {
  presetId: string;
  /** Manual crop in source pixels (after orientation). Overrides smart crop. */
  crop?: Rect;
  /** Focal point for automatic crop when no manual crop is given. */
  focus?: FocusPoint;
}

/** Facts about a produced file, consumed by validation. */
export interface OutputFacts {
  width: number;
  height: number;
  byteLength: number;
  format: ImageFormat | null;
  /** `null` when the file carries no DPI metadata. */
  dpi: { x: number; y: number } | null;
}
