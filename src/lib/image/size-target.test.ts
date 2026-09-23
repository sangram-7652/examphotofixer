import { describe, expect, it } from "vitest";
import {
  MAX_QUALITY,
  MIN_QUALITY,
  PREFERRED_MAX_QUALITY,
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
    const window = kbRangeToByteWindow({ min: 5, max: 50 });
    expect(window.minBytes).toBe(5 * 1024);
    expect(window.maxBytes).toBe(50 * 1000);
    expect(window.ceilingBytes).toBeLessThan(window.maxBytes);
    expect(window.ceilingBytes).toBeGreaterThan(window.minBytes);
  });

  it("rejects invalid ranges", () => {
    expect(() => kbRangeToByteWindow({ min: 10, max: 5 })).toThrow(RangeError);
    expect(() => kbRangeToByteWindow({ min: 10, max: 10.1 })).toThrow(RangeError);
  });
});

describe("findQualityForByteWindow", () => {
  const window: ByteWindow = kbRangeToByteWindow({ min: 5, max: 20 }); // 5120 – 20000, ceiling 19600

  it("keeps the preferred quality when it already fits (one encode)", async () => {
    const { encode, calls } = fakeEncoder(linear(1000, 100)); // q92 → 10200
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "in-range", quality: PREFERRED_MAX_QUALITY });
    expect(calls).toEqual([PREFERRED_MAX_QUALITY]);
  });

  it("finds the highest quality under the ceiling when too large", async () => {
    const bytesAt = linear(0, 300); // q92 → 27600; ceiling 19600 → q65 = 19500
    const { encode } = fakeEncoder(bytesAt);
    const result = await findQualityForByteWindow(encode, window);
    expect(result.status).toBe("in-range");
    expect(result.quality).toBe(65);
    expect(result.output.byteLength).toBeLessThanOrEqual(window.ceilingBytes);
    expect(bytesAt(result.quality + 1)).toBeGreaterThan(window.ceilingBytes);
  });

  it("is deterministic and bounded in encoder calls", async () => {
    const first = fakeEncoder(linear(0, 300));
    const second = fakeEncoder(linear(0, 300));
    await findQualityForByteWindow(first.encode, window);
    const result = await findQualityForByteWindow(second.encode, window);
    expect(first.calls).toEqual(second.calls);
    expect(result.attempts).toBeLessThanOrEqual(8);
  });

  it("raises quality above the preferred maximum only to reach the minimum", async () => {
    const bytesAt = linear(-40_000, 490); // q92 → 5080 (< 5120), q93 → 5570
    const { encode } = fakeEncoder(bytesAt);
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "in-range", quality: 93 });
  });

  it("reports too-small when even maximum quality is under the minimum", async () => {
    const { encode } = fakeEncoder(() => 3000);
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "too-small", quality: MAX_QUALITY });
  });

  it("reports too-large when even minimum quality exceeds the maximum", async () => {
    const { encode } = fakeEncoder(() => 90_000);
    const result = await findQualityForByteWindow(encode, window);
    expect(result).toMatchObject({ status: "too-large", quality: MIN_QUALITY });
  });

  it("accepts the exact byte boundaries", async () => {
    const atMin = await findQualityForByteWindow(
      async () => ({ byteLength: window.minBytes }),
      window,
    );
    expect(atMin.status).toBe("in-range");
  });
});
