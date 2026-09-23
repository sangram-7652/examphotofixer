import { describe, expect, it } from "vitest";
import { resolveCropRect } from "./crop";

const SOURCE = { width: 4000, height: 3000 };
const PORTRAIT = { width: 132, height: 170 };
const ratio = (r: { width: number; height: number }) => r.width / r.height;

describe("resolveCropRect", () => {
  it("defaults to a centred crop with the target aspect ratio", () => {
    const crop = resolveCropRect(SOURCE, PORTRAIT);
    expect(crop.height).toBe(3000);
    expect(crop.x).toBe(Math.round((4000 - crop.width) / 2));
    expect(ratio(crop)).toBeCloseTo(ratio(PORTRAIT), 2);
  });

  it("accepts a focus point", () => {
    expect(resolveCropRect(SOURCE, PORTRAIT, { mode: "auto", focus: { x: 0, y: 0.5 } }).x).toBe(0);
  });

  it("trims an explicit rectangle to the target ratio instead of stretching", () => {
    const crop = resolveCropRect(SOURCE, PORTRAIT, {
      mode: "rect",
      rect: { x: 100, y: 100, width: 2000, height: 2000 },
    });
    expect(crop.height).toBe(2000);
    expect(crop.width).toBe(Math.round(2000 * (132 / 170)));
    expect(crop.x).toBe(100 + Math.round((2000 - crop.width) / 2));
    expect(crop.y).toBe(100);
  });

  it("clamps explicit rectangles to the image and rejects ones outside it", () => {
    const crop = resolveCropRect(SOURCE, PORTRAIT, {
      mode: "rect",
      rect: { x: -500, y: -500, width: 1500, height: 1500 },
    });
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBe(0);
    expect(() =>
      resolveCropRect(SOURCE, PORTRAIT, {
        mode: "rect",
        rect: { x: 5000, y: 0, width: 10, height: 10 },
      }),
    ).toThrow(RangeError);
  });

  it("zooms around a normalised centre", () => {
    const base = resolveCropRect(SOURCE, PORTRAIT);
    const zoomed = resolveCropRect(SOURCE, PORTRAIT, {
      mode: "viewport",
      center: { x: 0.5, y: 0.5 },
      zoom: 2,
    });
    expect(zoomed.width).toBe(Math.round(base.width / 2));
    expect(zoomed.height).toBe(Math.round(base.height / 2));
    expect(Math.abs(zoomed.x + zoomed.width / 2 - 2000)).toBeLessThanOrEqual(1);
    expect(Math.abs(zoomed.y + zoomed.height / 2 - 1500)).toBeLessThanOrEqual(1);
  });

  it("clamps zoom below 1 and keeps the viewport inside the image", () => {
    expect(
      resolveCropRect(SOURCE, PORTRAIT, {
        mode: "viewport",
        center: { x: 0.5, y: 0.5 },
        zoom: 0.2,
      }),
    ).toEqual(resolveCropRect(SOURCE, PORTRAIT));
    const corner = resolveCropRect(SOURCE, PORTRAIT, {
      mode: "viewport",
      center: { x: 1, y: 1 },
      zoom: 3,
    });
    expect(corner.x + corner.width).toBe(4000);
    expect(corner.y + corner.height).toBe(3000);
  });
});
