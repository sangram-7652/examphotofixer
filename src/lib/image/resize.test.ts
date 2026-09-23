import { describe, expect, it } from "vitest";
import { MAX_FIRST_STEP_MULTIPLE, chooseDecodeScale, planResizeSteps } from "./resize";

const TARGET = { width: 132, height: 170 };

describe("planResizeSteps", () => {
  it("always ends at exactly the target size", () => {
    for (const source of [
      { width: 6000, height: 7727 },
      { width: 300, height: 386 },
      { width: 132, height: 170 },
      { width: 50, height: 64 },
    ]) {
      expect(planResizeSteps(source, TARGET).at(-1)).toEqual(TARGET);
    }
  });

  it("halves between steps and caps the first step", () => {
    const steps = planResizeSteps({ width: 6000, height: 7727 }, TARGET);
    expect(steps[0]).toEqual({
      width: TARGET.width * MAX_FIRST_STEP_MULTIPLE,
      height: TARGET.height * MAX_FIRST_STEP_MULTIPLE,
    });
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i - 1].width / steps[i].width).toBe(2);
    }
  });

  it("uses a single step for small reductions and for upscaling", () => {
    expect(planResizeSteps({ width: 250, height: 322 }, TARGET)).toEqual([TARGET]);
    expect(planResizeSteps({ width: 50, height: 64 }, TARGET)).toEqual([TARGET]);
  });

  it("keeps the first step inside the pixel budget", () => {
    const big = { width: 3000, height: 3000 };
    const steps = planResizeSteps({ width: 30_000, height: 30_000 }, big, 16_777_216);
    expect(steps[0].width * steps[0].height).toBeLessThanOrEqual(16_777_216);
  });
});

describe("chooseDecodeScale", () => {
  it("decodes huge photos at reduced size when the target is small", () => {
    const source = { width: 6000, height: 8000 };
    const crop = { width: 6000, height: 7727 };
    const scale = chooseDecodeScale(source, crop, TARGET);
    expect(scale).toBeLessThan(0.25);
    expect(crop.width * scale).toBeGreaterThanOrEqual(TARGET.width * MAX_FIRST_STEP_MULTIPLE - 1);
  });

  it("never upscales and respects the canvas budget", () => {
    expect(
      chooseDecodeScale({ width: 200, height: 200 }, { width: 100, height: 100 }, TARGET),
    ).toBe(1);
    const huge = { width: 10_000, height: 10_000 };
    const scale = chooseDecodeScale(huge, { width: 100, height: 100 }, TARGET);
    expect(huge.width * scale * huge.height * scale).toBeLessThanOrEqual(16_777_216 + 1);
  });
});
