import type { NumericRange } from "@/lib/presets/types";
import { readJpegDpi, writeJpegDpi } from "./jpeg";

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
