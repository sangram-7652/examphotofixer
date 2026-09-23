/**
 * Resize planning. Large reductions are done in steps of at most 2× so each
 * canvas draw samples cleanly (a single big downscale aliases). Intermediate
 * sizes are exact power-of-two multiples of the target, and the first one is
 * capped so large photos never need a full-resolution canvas.
 */

import type { Size } from "./geometry";
import { MAX_CANVAS_PIXELS } from "./limits";

/** Largest multiple of the target used for the first intermediate canvas. */
export const MAX_FIRST_STEP_MULTIPLE = 8;

/**
 * Canvas sizes to draw through, ending with exactly `target`.
 * `source` is the crop size in decoded pixels. Upscaling is a single step.
 */
export function planResizeSteps(
  source: Size,
  target: Size,
  maxPixels: number = MAX_CANVAS_PIXELS,
): Size[] {
  const ratio = Math.min(source.width / target.width, source.height / target.height);
  let multiple = 1;
  while (
    multiple * 2 < ratio &&
    multiple * 2 <= MAX_FIRST_STEP_MULTIPLE &&
    (multiple * 2) ** 2 * target.width * target.height <= maxPixels
  ) {
    multiple *= 2;
  }
  const steps: Size[] = [];
  for (let m = multiple; m >= 1; m /= 2) {
    steps.push({ width: target.width * m, height: target.height * m });
  }
  return steps;
}

/**
 * Decode scale (≤ 1) that keeps enough detail for the first resize step while
 * staying under the canvas pixel budget. Lets huge photos decode small.
 */
export function chooseDecodeScale(
  sourcePixels: Size,
  crop: Size,
  target: Size,
  maxPixels: number = MAX_CANVAS_PIXELS,
): number {
  const needed = Math.max(
    (MAX_FIRST_STEP_MULTIPLE * target.width) / crop.width,
    (MAX_FIRST_STEP_MULTIPLE * target.height) / crop.height,
  );
  const budget = Math.sqrt(maxPixels / (sourcePixels.width * sourcePixels.height));
  return Math.min(1, needed, budget);
}
