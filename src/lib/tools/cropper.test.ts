import { describe, expect, it } from "vitest";
import { resolveCropRect } from "@/lib/image/crop";
import { INITIAL_CROP, MAX_UI_ZOOM, panCrop, viewportLayout, zoomCrop } from "./cropper";

const SOURCE = { width: 4000, height: 3000 };
const TARGET = { width: 132, height: 170 };
const FRAME = 264;

describe("cropper view math", () => {
  it("lays the image out so the engine's crop fills the frame", () => {
    const rect = resolveCropRect(SOURCE, TARGET, INITIAL_CROP);
    const layout = viewportLayout(SOURCE, TARGET, INITIAL_CROP, FRAME);
    expect(layout.scale).toBeCloseTo(FRAME / rect.width);
    expect(layout.offsetX).toBeCloseTo(-rect.x * layout.scale);
    expect(layout.width / layout.height).toBeCloseTo(SOURCE.width / SOURCE.height); // no distortion
  });

  it("dragging right moves the crop left", () => {
    const moved = panCrop(SOURCE, TARGET, INITIAL_CROP, 50, 0, FRAME);
    expect(moved.center.x).toBeLessThan(0.5);
    expect(moved.center.y).toBeCloseTo(0.5);
  });

  it("clamps panning at the image edge without overshoot", () => {
    const far = panCrop(SOURCE, TARGET, INITIAL_CROP, 100_000, 0, FRAME);
    const rect = resolveCropRect(SOURCE, TARGET, far);
    expect(rect.x).toBe(0);
    // Moving back responds immediately (centre was normalised to the clamped rect).
    const back = panCrop(SOURCE, TARGET, far, -10, 0, FRAME);
    expect(resolveCropRect(SOURCE, TARGET, back).x).toBeGreaterThan(0);
  });

  it("zoom is clamped to the UI range", () => {
    expect(zoomCrop(SOURCE, TARGET, INITIAL_CROP, 0.3).zoom).toBe(1);
    expect(zoomCrop(SOURCE, TARGET, INITIAL_CROP, 99).zoom).toBe(MAX_UI_ZOOM);
    const zoomed = zoomCrop(SOURCE, TARGET, INITIAL_CROP, 2);
    expect(resolveCropRect(SOURCE, TARGET, zoomed).width).toBe(
      Math.round(resolveCropRect(SOURCE, TARGET, INITIAL_CROP).width / 2),
    );
  });
});
