/**
 * Cropper view math. Crop geometry itself comes from the engine
 * (`resolveCropRect`); these helpers only translate pointer/keyboard input into
 * a viewport crop spec and lay the image out under the crop frame.
 */

import { resolveCropRect } from "@/lib/image/crop";
import type { Size } from "@/lib/image/geometry";

export interface ViewportCrop {
  mode: "viewport";
  center: { x: number; y: number };
  zoom: number;
}

/** Maximum zoom offered in the UI (the engine allows more). */
export const MAX_UI_ZOOM = 4;

export const INITIAL_CROP: ViewportCrop = { mode: "viewport", center: { x: 0.5, y: 0.5 }, zoom: 1 };

export interface ViewportLayout {
  /** Rendered image size and offset (CSS px) inside the frame. */
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  /** CSS px per source px. */
  scale: number;
}

/** Positions the image so the engine's crop rectangle fills a frame `frameWidth` px wide. */
export function viewportLayout(
  source: Size,
  target: Size,
  crop: ViewportCrop,
  frameWidth: number,
): ViewportLayout {
  const rect = resolveCropRect(source, target, crop);
  const scale = frameWidth / rect.width;
  return {
    width: source.width * scale,
    height: source.height * scale,
    offsetX: -rect.x * scale,
    offsetY: -rect.y * scale,
    scale,
  };
}

/** Re-centres the spec on the rectangle the engine will actually use (removes overshoot). */
export function normalizeCrop(source: Size, target: Size, crop: ViewportCrop): ViewportCrop {
  const zoom = Math.min(MAX_UI_ZOOM, Math.max(1, crop.zoom));
  const rect = resolveCropRect(source, target, { ...crop, zoom });
  return {
    mode: "viewport",
    zoom,
    center: {
      x: (rect.x + rect.width / 2) / source.width,
      y: (rect.y + rect.height / 2) / source.height,
    },
  };
}

/** Moves the image by a screen-space drag (dx, dy in CSS px). */
export function panCrop(
  source: Size,
  target: Size,
  crop: ViewportCrop,
  dx: number,
  dy: number,
  frameWidth: number,
): ViewportCrop {
  const { scale } = viewportLayout(source, target, crop, frameWidth);
  return normalizeCrop(source, target, {
    ...crop,
    center: {
      x: crop.center.x - dx / scale / source.width,
      y: crop.center.y - dy / scale / source.height,
    },
  });
}

export function zoomCrop(
  source: Size,
  target: Size,
  crop: ViewportCrop,
  zoom: number,
): ViewportCrop {
  return normalizeCrop(source, target, { ...crop, zoom });
}
