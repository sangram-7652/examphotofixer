import type { ProgressStage } from "@/lib/image/pipeline";

/** User-facing processing steps. Each engine stage maps to one step. */
export const PROGRESS_STEPS = [
  "Preparing image",
  "Correcting orientation",
  "Cropping",
  "Resizing",
  "Compressing",
  "Validating",
  "Complete",
] as const;

export type ProgressStep = (typeof PROGRESS_STEPS)[number];

const STAGE_TO_STEP: Readonly<Record<ProgressStage, ProgressStep>> = {
  loading: "Preparing image",
  orientation: "Correcting orientation",
  cropping: "Cropping",
  resizing: "Resizing",
  encoding: "Compressing",
  // DPI and metadata are written while compressing; these stages verify them.
  dpi: "Validating",
  metadata: "Validating",
  validation: "Validating",
  complete: "Complete",
};

export function stepForStage(stage: ProgressStage): ProgressStep {
  return STAGE_TO_STEP[stage];
}

/** Index of the current step (−1 before the first progress event). */
export function stepIndex(stage: ProgressStage | null): number {
  return stage ? PROGRESS_STEPS.indexOf(STAGE_TO_STEP[stage]) : -1;
}
