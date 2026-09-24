/**
 * Feature detection for the image engine. Tiny and dependency-free so pages can
 * check support without loading the engine.
 */
export function isImageProcessingSupported(): boolean {
  if (
    typeof Worker !== "function" ||
    typeof OffscreenCanvas !== "function" ||
    typeof createImageBitmap !== "function"
  ) {
    return false;
  }
  try {
    const canvas = new OffscreenCanvas(1, 1);
    return canvas.getContext("2d") !== null && typeof canvas.convertToBlob === "function";
  } catch {
    return false;
  }
}
