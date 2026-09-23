import type { NumericRange } from "@/lib/presets/types";

/**
 * DPI written into output files when the preset allows it. 150 sits strictly
 * inside every current preset range, so off-by-one checks on portals at the
 * range edges cannot reject it.
 */
export const PREFERRED_OUTPUT_DPI = 150;

export function chooseOutputDpi(range: NumericRange): number {
  if (!(range.min > 0) || range.max < range.min) {
    throw new RangeError("DPI range must satisfy 0 < min <= max");
  }
  return Math.round(Math.min(range.max, Math.max(range.min, PREFERRED_OUTPUT_DPI)));
}
