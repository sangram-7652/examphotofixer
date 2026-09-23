import { describe, expect, it } from "vitest";
import {
  applyMatrix,
  normalizeOrientation,
  orientationMatrix,
  orientedToRawRect,
  type ExifOrientation,
} from "./orientation";

const RAW = { width: 40, height: 30 };
const ORIENTATIONS: ExifOrientation[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Hand-written expectations: which raw corner ends up at the displayed
 * top-left and top-right. Raw corners: TL(0,0) TR(W,0) BL(0,H) BR(W,H).
 */
const EXPECTED: Record<ExifOrientation, { topLeft: string; topRight: string }> = {
  1: { topLeft: "TL", topRight: "TR" },
  2: { topLeft: "TR", topRight: "TL" }, // mirrored
  3: { topLeft: "BR", topRight: "BL" }, // 180°
  4: { topLeft: "BL", topRight: "BR" }, // flipped vertically
  5: { topLeft: "TL", topRight: "BL" }, // transposed
  6: { topLeft: "BL", topRight: "TL" }, // 90° clockwise
  7: { topLeft: "BR", topRight: "TR" }, // transverse
  8: { topLeft: "TR", topRight: "BR" }, // 90° counter-clockwise
};

const CORNERS = { TL: [0, 0], TR: [40, 0], BL: [0, 30], BR: [40, 30] } as const;

describe("orientationMatrix", () => {
  it.each(ORIENTATIONS)("orientation %i maps raw corners to the displayed corners", (o) => {
    const matrix = orientationMatrix(o, RAW);
    const orientedWidth = o >= 5 ? RAW.height : RAW.width;
    const at = (corner: keyof typeof CORNERS) => {
      const [u, v] = CORNERS[corner];
      return applyMatrix(matrix, u, v);
    };
    expect(at(EXPECTED[o].topLeft as keyof typeof CORNERS)).toEqual({ x: 0, y: 0 });
    expect(at(EXPECTED[o].topRight as keyof typeof CORNERS)).toEqual({ x: orientedWidth, y: 0 });
  });
});

describe("orientedToRawRect", () => {
  it.each(ORIENTATIONS)("orientation %i round-trips through the matrix", (o) => {
    const orientedRect = { x: 5, y: 3, width: 10, height: 20 };
    const raw = orientedToRawRect(orientedRect, o, RAW);
    const matrix = orientationMatrix(o, RAW);
    const corners = [
      applyMatrix(matrix, raw.x, raw.y),
      applyMatrix(matrix, raw.x + raw.width, raw.y + raw.height),
    ];
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    expect({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }).toEqual(orientedRect);
  });
});

describe("normalizeOrientation", () => {
  it("defaults invalid values to 1", () => {
    expect(normalizeOrientation(null)).toBe(1);
    expect(normalizeOrientation(0)).toBe(1);
    expect(normalizeOrientation(9)).toBe(1);
    expect(normalizeOrientation(6)).toBe(6);
  });
});
