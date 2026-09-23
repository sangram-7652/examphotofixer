/**
 * Typed messages between the main thread and the image worker.
 * Everything here is structured-clone safe (Blobs are passed by reference).
 */

import type { ValidationReport } from "@/lib/validation/types";
import type { CropSpec } from "../crop";
import type { CompressionSummary, SourceInfo } from "../engine";
import type { Rect } from "../geometry";
import {
  PROGRESS_STAGES,
  type OutputFacts,
  type OutputRequirements,
  type ProcessingErrorCode,
  type ProcessingStage,
  type ProgressStage,
} from "../pipeline";

export interface ImageProcessingRequest {
  type: "process";
  jobId: string;
  file: Blob;
  requirements: OutputRequirements;
  crop?: CropSpec;
}

export interface ImageProcessingProgress {
  stage: ProgressStage;
  /** 1-based position of `stage` in PROGRESS_STAGES. */
  step: number;
  totalSteps: number;
  /** step / totalSteps, 0–1. */
  fraction: number;
}

export interface ImageProcessingResult {
  /** Final JPEG. */
  blob: Blob;
  /** Facts read back from the final bytes. */
  facts: OutputFacts;
  compression: CompressionSummary;
  validation: ValidationReport;
  source: SourceInfo;
  crop: Rect;
}

export interface ImageProcessingErrorInfo {
  code: ProcessingErrorCode;
  stage: ProcessingStage;
  message: string;
}

export type WorkerResponse =
  | { type: "progress"; jobId: string; progress: ImageProcessingProgress }
  | { type: "result"; jobId: string; result: ImageProcessingResult }
  | { type: "error"; jobId: string; error: ImageProcessingErrorInfo };

export function progressFor(stage: ProgressStage): ImageProcessingProgress {
  const step = PROGRESS_STAGES.indexOf(stage) + 1;
  const totalSteps = PROGRESS_STAGES.length;
  return { stage, step, totalSteps, fraction: step / totalSteps };
}
