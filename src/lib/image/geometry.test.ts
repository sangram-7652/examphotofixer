import { describe, expect, it } from "vitest";
import { aspectRatio, computeCoverCrop, orientedSize, scaleToFitPixelBudget } from "./geometry";

const PHOTO = { width: 132, height: 170 };
const SIGNATURE = { width: 170, height: 132 };

function expectRatioClose(rect: { width: number; height: number }, target: typeof PHOTO) {
  // Integer rounding can shift the ratio by at most one pixel's worth.
  expect(Math.abs(rect.width / rect.height - aspectRatio(target))).toBeLessThan(2 / rect.height);
}

describe("computeCoverCrop", () => {
  it("crops a landscape source to a portrait target, centred", () => {
    const crop = computeCoverCrop({ width: 4000, height: 3000 }, PHOTO);
    expect(crop.height).toBe(3000);
    expect(crop.width).toBe(Math.round(3000 * (132 / 170)));
    expect(crop.x).toBe(Math.round((4000 - crop.width) / 2));
    expect(crop.y).toBe(0);
    expectRatioClose(crop, PHOTO);
  });

  it("crops a portrait source to a landscape target", () => {
    const crop = computeCoverCrop({ width: 3000, height: 4000 }, SIGNATURE);
    expect(crop.width).toBe(3000);
    expect(crop.x).toBe(0);
    expectRatioClose(crop, SIGNATURE);
  });

  it("crops a square source without exceeding its bounds", () => {
    const source = { width: 1000, height: 1000 };
    for (const target of [PHOTO, SIGNATURE]) {
      const crop = computeCoverCrop(source, target);
      expect(crop.x + crop.width).toBeLessThanOrEqual(1000);
      expect(crop.y + crop.height).toBeLessThanOrEqual(1000);
      expectRatioClose(crop, target);
    }
  });

  it("returns the full source when ratios already match", () => {
    expect(computeCoverCrop({ width: 264, height: 340 }, PHOTO)).toEqual({
      x: 0,
      y: 0,
      width: 264,
      height: 340,
    });
  });

  it("clamps the focus point to keep the crop inside the source", () => {
    const source = { width: 4000, height: 3000 };
    expect(computeCoverCrop(source, PHOTO, { x: 0, y: 0 }).x).toBe(0);
    const right = computeCoverCrop(source, PHOTO, { x: 5, y: 0.5 });
    expect(right.x + right.width).toBe(4000);
  });

  it("rejects invalid sizes", () => {
    expect(() => computeCoverCrop({ width: 0, height: 10 }, PHOTO)).toThrow(RangeError);
    expect(() => computeCoverCrop({ width: 10, height: 10 }, { width: NaN, height: 1 })).toThrow(
      RangeError,
    );
  });
});

describe("scaleToFitPixelBudget", () => {
  it("does not upscale small images", () => {
    expect(scaleToFitPixelBudget({ width: 800, height: 600 }, 16_777_216)).toBe(1);
  });

  it("downscales huge images under the budget", () => {
    const size = { width: 12_000, height: 9_000 };
    const scale = scaleToFitPixelBudget(size, 16_777_216);
    expect(scale).toBeLessThan(1);
    expect(size.width * scale * size.height * scale).toBeLessThanOrEqual(16_777_216 + 1);
  });
});

describe("orientedSize", () => {
  it.each([1, 2, 3, 4])("keeps dimensions for EXIF orientation %i", (orientation) => {
    expect(orientedSize({ width: 4000, height: 3000 }, orientation)).toEqual({
      width: 4000,
      height: 3000,
    });
  });

  it.each([5, 6, 7, 8])("swaps dimensions for EXIF orientation %i", (orientation) => {
    expect(orientedSize({ width: 4000, height: 3000 }, orientation)).toEqual({
      width: 3000,
      height: 4000,
    });
  });
});
