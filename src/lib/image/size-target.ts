/**
 * File-size targeting for JPEG output.
 *
 * Strategy: produce the highest quality that fits inside the allowed byte
 * window, below a small safety margin under the maximum. We do not aim for the
 * minimum size — that throws away quality for no benefit.
 */

import type { NumericRange } from "@/lib/presets/types";

export interface ByteWindow {
  minBytes: number;
  maxBytes: number;
  /** Preferred upper bound: `maxBytes` minus a safety margin. */
  ceilingBytes: number;
}

/** JPEG quality above this adds bytes with little visible gain; exceeded only to reach the minimum size. */
export const PREFERRED_MAX_QUALITY = 92;
export const MIN_QUALITY = 30;
export const MAX_QUALITY = 100;

/**
 * Converts a KB range from an official source into a byte window that satisfies
 * both common interpretations of "KB" (1000 and 1024 bytes):
 * min uses 1024 (the larger), max uses 1000 (the smaller).
 */
export function kbRangeToByteWindow(range: NumericRange): ByteWindow {
  if (!(range.min >= 0) || !(range.max > range.min)) {
    throw new RangeError("File-size range must satisfy 0 <= min < max");
  }
  const minBytes = Math.ceil(range.min * 1024);
  const maxBytes = Math.floor(range.max * 1000);
  if (minBytes >= maxBytes) {
    throw new RangeError("File-size range is too narrow once KB ambiguity is removed");
  }
  const margin = Math.max(256, Math.floor(maxBytes * 0.02));
  const ceilingBytes = Math.max(minBytes, maxBytes - margin);
  return { minBytes, maxBytes, ceilingBytes };
}

export interface EncodeResult {
  byteLength: number;
}

export type Encoder<T extends EncodeResult> = (quality: number) => Promise<T>;

export type QualitySearchStatus = "in-range" | "too-large" | "too-small";

export interface QualitySearchResult<T extends EncodeResult> {
  status: QualitySearchStatus;
  quality: number;
  output: T;
  /** Number of encoder calls made (for tests and performance budgets). */
  attempts: number;
}

/**
 * Finds a JPEG quality whose output lands in `window`.
 *
 * Deterministic for a deterministic encoder. Assumes output size is roughly
 * monotonic in quality, and re-checks the final candidate against the window.
 */
export async function findQualityForByteWindow<T extends EncodeResult>(
  encode: Encoder<T>,
  window: ByteWindow,
): Promise<QualitySearchResult<T>> {
  const cache = new Map<number, T>();
  const run = async (quality: number): Promise<T> => {
    const cached = cache.get(quality);
    if (cached) return cached;
    const output = await encode(quality);
    cache.set(quality, output);
    return output;
  };
  const inWindow = (bytes: number) => bytes >= window.minBytes && bytes <= window.maxBytes;
  const result = (status: QualitySearchStatus, quality: number, output: T) => ({
    status,
    quality,
    output,
    attempts: cache.size,
  });

  const preferred = await run(PREFERRED_MAX_QUALITY);
  if (preferred.byteLength >= window.minBytes && preferred.byteLength <= window.ceilingBytes) {
    return result("in-range", PREFERRED_MAX_QUALITY, preferred);
  }

  if (preferred.byteLength > window.ceilingBytes) {
    // Highest quality in [MIN_QUALITY, PREFERRED_MAX_QUALITY) under the ceiling.
    let lo = MIN_QUALITY;
    let hi = PREFERRED_MAX_QUALITY - 1;
    let best: number | null = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if ((await run(mid)).byteLength <= window.ceilingBytes) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best === null) {
      const floor = await run(MIN_QUALITY);
      return result(inWindow(floor.byteLength) ? "in-range" : "too-large", MIN_QUALITY, floor);
    }
    const output = await run(best);
    return result(inWindow(output.byteLength) ? "in-range" : "too-small", best, output);
  }

  // Too small at the preferred quality: lowest quality above it that reaches the minimum.
  let lo = PREFERRED_MAX_QUALITY + 1;
  let hi = MAX_QUALITY;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await run(mid)).byteLength >= window.minBytes) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  if (best === null) {
    return result("too-small", MAX_QUALITY, await run(MAX_QUALITY));
  }
  const output = await run(best);
  return result(inWindow(output.byteLength) ? "in-range" : "too-large", best, output);
}
