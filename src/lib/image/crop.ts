/**
 * Crop configuration. All coordinates are in the *oriented* source image
 * (what the user sees after EXIF orientation), in source pixels.
 *
 * Every mode resolves to a rectangle with the target aspect ratio, so the
 * later resize is a uniform scale — images are never stretched.
 */

import { computeCoverCrop, type FocusPoint, type Rect, type Size } from "./geometry";

export type CropSpec =
  /** Largest target-ratio crop, centred on `focus` (default: image centre). */
  | { mode: "auto"; focus?: FocusPoint }
  /** Explicit rectangle. Clamped to the image and trimmed (centred) to the target ratio. */
  | { mode: "rect"; rect: Rect }
  /** Cropper-UI style: normalised centre plus zoom ≥ 1 relative to the auto crop. */
  | { mode: "viewport"; center: FocusPoint; zoom: number };

export const MAX_ZOOM = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function resolveCropRect(
  source: Size,
  target: Size,
  spec: CropSpec = { mode: "auto" },
): Rect {
  switch (spec.mode) {
    case "auto":
      return computeCoverCrop(source, target, spec.focus);

    case "rect": {
      const x0 = clamp(Math.round(spec.rect.x), 0, source.width);
      const y0 = clamp(Math.round(spec.rect.y), 0, source.height);
      const x1 = clamp(Math.round(spec.rect.x + spec.rect.width), 0, source.width);
      const y1 = clamp(Math.round(spec.rect.y + spec.rect.height), 0, source.height);
      if (x1 - x0 < 1 || y1 - y0 < 1) {
        throw new RangeError("Crop rectangle does not overlap the image");
      }
      const inner = computeCoverCrop({ width: x1 - x0, height: y1 - y0 }, target);
      return { ...inner, x: inner.x + x0, y: inner.y + y0 };
    }

    case "viewport": {
      if (!Number.isFinite(spec.zoom)) throw new RangeError("Zoom must be a finite number");
      const zoom = clamp(spec.zoom, 1, MAX_ZOOM);
      const base = computeCoverCrop(source, target);
      const width = Math.max(1, Math.round(base.width / zoom));
      const height = Math.max(1, Math.round(base.height / zoom));
      const cx = clamp(spec.center.x, 0, 1) * source.width;
      const cy = clamp(spec.center.y, 0, 1) * source.height;
      return {
        x: Math.round(clamp(cx - width / 2, 0, source.width - width)),
        y: Math.round(clamp(cy - height / 2, 0, source.height - height)),
        width,
        height,
      };
    }
  }
}
