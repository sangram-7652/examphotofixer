import { describe, expect, it } from "vitest";
import {
  MAX_QUALITY,
  MIN_QUALITY,
  findQualityForByteWindow,
  kbRangeToByteWindow,
  type ByteWindow,
} from "./size-target";

/** Deterministic fake encoder: output size is a fixed monotonic function of quality. */
function fakeEncoder(bytesAt: (quality: number) => number) {
  const calls: number[] = [];
  const encode = async (quality: number) => {
    calls.push(quality);
    return { byteLength: bytesAt(quality), quality };
  };
  return { encode, calls };
}

const linear = (base: number, perStep: number) => (q: number) => base + q * perStep;

describe("kbRangeToByteWindow", () => {
  it("satisfies both 1000- and 1024-byte KB interpretations", () => {
    expect(kbRangeToByteWindow({ min: 5, max: 50 })).toEqual({ minBytes: 5120, maxBytes: 50_000 });
  });

  it("rejects invalid ranges", () => {
    expect(() => kbRangeToByteWindow({ min: 10, max: 5 })).toThrow(RangeError);
    expect(() => kbRangeToByteWindow({ min: 10, max: 10.1 })).toThrow(RangeError);
  });
});

describe("findQualityForByteWindow", () => {
  const window: ByteWindow = kbRangeToByteWindow({ min: 5, max: 20 }); // 5120 – 20000

  it("uses maximum quality when it already fits (one encode)", async () => {
    const { encode, calls } = fakeEncoder(linear(1000, 100)); // q100 → 11000
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "within_range", quality: MAX_QUALITY, attempts: 1 });
    expect(calls).toEqual([MAX_QUALITY]);
  });

  it("finds the highest quality under the maximum (binary search)", async () => {
    const bytesAt = linear(0, 300); // q66 → 19800, q67 → 20100
    const { encode, calls } = fakeEncoder(bytesAt);
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "within_range", quality: 66 });
    expect(bytesAt(67)).toBeGreaterThan(window.maxBytes);
    expect(calls.length).toBeLessThanOrEqual(8);
  });

  it("is deterministic", async () => {
    const first = fakeEncoder(linear(0, 300));
    const second = fakeEncoder(linear(0, 300));
    const a = await findQualityForByteWindow(first.encode, window);
    const b = await findQualityForByteWindow(second.encode, window);
    expect(first.calls).toEqual(second.calls);
    expect(a.quality).toBe(b.quality);
  });

  it("accepts outputs exactly at the byte boundaries", async () => {
    for (const bytes of [window.minBytes, window.maxBytes]) {
      const result = await findQualityForByteWindow(async () => ({ byteLength: bytes }), window);
      expect(result.status).toBe("within_range");
    }
  });

  it("returns below_minimum with the maximum-quality output (no padding, no retries)", async () => {
    const { encode, calls } = fakeEncoder(() => 3000);
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "below_minimum", quality: MAX_QUALITY });
    expect(result.output?.byteLength).toBe(3000);
    expect(calls).toEqual([MAX_QUALITY]);
  });

  it("returns above_maximum with the lowest-quality output", async () => {
    const { encode } = fakeEncoder(() => 90_000);
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "above_maximum", quality: MIN_QUALITY });
  });

  it("returns unable_to_process when the encoder fails", async () => {
    const result = await findQualityForByteWindow(async () => {
      throw new Error("boom");
    }, window);
    expect(result.status).toBe("unable_to_process");
  });

  it("respects custom quality bounds", async () => {
    const { encode, calls } = fakeEncoder(linear(0, 300));
    await findQualityForByteWindow(encode, window, { min: 50, max: 90 });
    expect(Math.min(...calls)).toBeGreaterThanOrEqual(50);
    expect(Math.max(...calls)).toBeLessThanOrEqual(90);
  });
});
