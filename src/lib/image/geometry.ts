/**
 * Pure geometry for crop + resize. Images are never stretched: the source is
 * cropped to the target aspect ratio, then scaled uniformly to the target size.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalised focal point, (0, 0) = top-left, (1, 1) = bottom-right. */
export interface FocusPoint {
  x: number;
  y: number;
}

const CENTER: FocusPoint = { x: 0.5, y: 0.5 };

function assertPositiveSize(size: Size, name: string): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new RangeError(`${name} must have positive, finite dimensions`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function aspectRatio(size: Size): number {
  assertPositiveSize(size, "size");
  return size.width / size.height;
}

/**
 * Largest integer-pixel rectangle inside `source` with the aspect ratio of
 * `target`, positioned as close as possible to `focus` (default: centre).
 */
export function computeCoverCrop(source: Size, target: Size, focus: FocusPoint = CENTER): Rect {
  assertPositiveSize(source, "source");
  assertPositiveSize(target, "target");

  const targetRatio = target.width / target.height;
  let width = source.width;
  let height = Math.round(width / targetRatio);
  if (height > source.height) {
    height = source.height;
    width = Math.round(height * targetRatio);
  }
  width = clamp(width, 1, source.width);
  height = clamp(height, 1, source.height);

  const fx = clamp(focus.x, 0, 1);
  const fy = clamp(focus.y, 0, 1);
  const x = Math.round(clamp(fx * source.width - width / 2, 0, source.width - width));
  const y = Math.round(clamp(fy * source.height - height / 2, 0, source.height - height));

  return { x, y, width, height };
}

/**
 * Uniform scale factor (≤ 1) that keeps `size` within `maxPixels`, used to
 * downscale very large inputs before they reach a canvas.
 */
export function scaleToFitPixelBudget(size: Size, maxPixels: number): number {
  assertPositiveSize(size, "size");
  const pixels = size.width * size.height;
  return pixels <= maxPixels ? 1 : Math.sqrt(maxPixels / pixels);
}

/** Dimensions after a 90°/270° EXIF rotation swap width and height. */
export function orientedSize(size: Size, exifOrientation: number): Size {
  return exifOrientation >= 5 && exifOrientation <= 8
    ? { width: size.height, height: size.width }
    : size;
}
