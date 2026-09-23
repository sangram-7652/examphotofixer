/**
 * File-size targeting for JPEG output.
 *
 * Strategy: the highest quality whose *final* bytes fit under the maximum.
 * If even maximum quality is below the minimum, the output is kept as-is and
 * reported as `below_minimum` — we never pad files, add noise or alter pixels
 * to inflate size (locked product decision, see docs/IMAGE_PROCESSING.md).
 */

import type { NumericRange } from "@/lib/presets/types";

export interface ByteWindow {
  minBytes: number;
  maxBytes: number;
}

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
  return { minBytes, maxBytes };
}

export interface EncodeResult {
  byteLength: number;
}

/** Encodes at an integer quality 1–100 and returns the final bytes' size. */
export type Encoder<T extends EncodeResult> = (quality: number) => Promise<T>;

export type CompressionStatus =
  | "within_range"
  /** Highest quality output is still smaller than the minimum; returned unchanged. */
  | "below_minimum"
  /** Even the lowest allowed quality exceeds the maximum; smallest output returned. */
  | "above_maximum"
  /** The encoder failed. */
  | "unable_to_process";

export type CompressionResult<T extends EncodeResult> =
  | {
      status: Exclude<CompressionStatus, "unable_to_process">;
      quality: number;
      output: T;
      /** Encoder calls made (for tests and performance budgets). */
      attempts: number;
    }
  | { status: "unable_to_process"; quality: null; output: null; attempts: number; error: unknown };

export interface QualityBounds {
  min: number;
  max: number;
}

/**
 * Finds the highest JPEG quality whose output fits `window.maxBytes`.
 *
 * One encode when maximum quality already fits; otherwise a binary search
 * (≤ 7 more encodes). Deterministic for a deterministic encoder. Assumes size
 * grows with quality and re-checks the chosen output against the window.
 */
export async function findQualityForByteWindow<T extends EncodeResult>(
  encode: Encoder<T>,
  window: ByteWindow,
  bounds: QualityBounds = { min: MIN_QUALITY, max: MAX_QUALITY },
): Promise<CompressionResult<T>> {
  const cache = new Map<number, T>();
  const run = async (quality: number): Promise<T> => {
    const cached = cache.get(quality);
    if (cached) return cached;
    const output = await encode(quality);
    cache.set(quality, output);
    return output;
  };
  const settle = (quality: number, output: T): CompressionResult<T> => ({
    status:
      output.byteLength > window.maxBytes
        ? "above_maximum"
        : output.byteLength < window.minBytes
          ? "below_minimum"
          : "within_range",
    quality,
    output,
    attempts: cache.size,
  });

  try {
    const best = await run(bounds.max);
    if (best.byteLength <= window.maxBytes) return settle(bounds.max, best);

    let lo = bounds.min;
    let hi = bounds.max - 1;
    let found: number | null = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if ((await run(mid)).byteLength <= window.maxBytes) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const quality = found ?? bounds.min;
    return settle(quality, await run(quality));
  } catch (error) {
    return {
      status: "unable_to_process",
      quality: null,
      output: null,
      attempts: cache.size,
      error,
    };
  }
}
