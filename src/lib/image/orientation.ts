/**
 * EXIF orientation (1–8) math. Pure; used by the renderer to draw the raw
 * decoded bitmap in its intended visual orientation.
 *
 * Raw image: width W, height H. A raw point (u, v) appears at oriented (x, y):
 *   1: (u, v)          2: (W−u, v)        3: (W−u, H−v)      4: (u, H−v)
 *   5: (v, u)          6: (H−v, u)        7: (H−v, W−u)      8: (v, W−u)
 * 6 = rotate 90° clockwise, 8 = rotate 90° counter-clockwise, 3 = 180°.
 */

import type { Rect, Size } from "./geometry";

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Canvas 2D transform [a, b, c, d, e, f]: x = a·u + c·v + e, y = b·u + d·v + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export function normalizeOrientation(value: number | null | undefined): ExifOrientation {
  return value !== null &&
    value !== undefined &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 8
    ? (value as ExifOrientation)
    : 1;
}

export function swapsDimensions(orientation: ExifOrientation): boolean {
  return orientation >= 5;
}

/** Transform that maps a raw image of size `raw` drawn at (0, 0) into oriented space. */
export function orientationMatrix(orientation: ExifOrientation, raw: Size): Matrix {
  const { width: W, height: H } = raw;
  switch (orientation) {
    case 1:
      return [1, 0, 0, 1, 0, 0];
    case 2:
      return [-1, 0, 0, 1, W, 0];
    case 3:
      return [-1, 0, 0, -1, W, H];
    case 4:
      return [1, 0, 0, -1, 0, H];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, H, 0];
    case 7:
      return [0, -1, -1, 0, H, W];
    case 8:
      return [0, -1, 1, 0, 0, W];
  }
}

export function applyMatrix(matrix: Matrix, u: number, v: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * u + c * v + e, y: b * u + d * v + f };
}

/** Oriented point → raw point (inverse of the table above). */
function toRaw(orientation: ExifOrientation, raw: Size, x: number, y: number) {
  const { width: W, height: H } = raw;
  switch (orientation) {
    case 1:
      return { u: x, v: y };
    case 2:
      return { u: W - x, v: y };
    case 3:
      return { u: W - x, v: H - y };
    case 4:
      return { u: x, v: H - y };
    case 5:
      return { u: y, v: x };
    case 6:
      return { u: y, v: H - x };
    case 7:
      return { u: W - y, v: H - x };
    case 8:
      return { u: W - y, v: x };
  }
}

/** Maps a rectangle in oriented coordinates to the matching rectangle in raw coordinates. */
export function orientedToRawRect(rect: Rect, orientation: ExifOrientation, raw: Size): Rect {
  const a = toRaw(orientation, raw, rect.x, rect.y);
  const b = toRaw(orientation, raw, rect.x + rect.width, rect.y + rect.height);
  return {
    x: Math.min(a.u, b.u),
    y: Math.min(a.v, b.v),
    width: Math.abs(b.u - a.u),
    height: Math.abs(b.v - a.v),
  };
}
