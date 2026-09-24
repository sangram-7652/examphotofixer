import type { DpiRange } from "@/lib/presets/types";
import { readJpegDpi, writeJpegDpi } from "./jpeg";

/**
 * DPI written into output files when the preset allows it. 150 sits strictly
 * inside the bounded CCC ranges, so off-by-one checks at the range edges can't
 * reject it. For a minimum-only range above 150 (e.g. IBPS "minimum of 200
 * dpi") the minimum itself is written, which satisfies it exactly.
 */
export const PREFERRED_OUTPUT_DPI = 150;

export function chooseOutputDpi(range: DpiRange): number {
  const max = range.max ?? Number.POSITIVE_INFINITY;
  if (!(range.min > 0) || max < range.min) {
    throw new RangeError("DPI range must satisfy 0 < min <= max");
  }
  return Math.round(Math.min(max, Math.max(range.min, PREFERRED_OUTPUT_DPI)));
}

/**
 * Returns a JPEG Blob with JFIF density set to `dpi` dots per inch.
 * DPI is metadata only: pixel dimensions and image data are unchanged.
 */
export async function writeDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([writeJpegDpi(bytes, dpi)], { type: "image/jpeg" });
}

/** Reads DPI from a JPEG Blob (JFIF density, falling back to EXIF), or `null`. */
export async function readDpi(blob: Blob): Promise<{ x: number; y: number } | null> {
  return readJpegDpi(new Uint8Array(await blob.arrayBuffer()));
}
