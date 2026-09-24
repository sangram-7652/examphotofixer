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

/** Output formats this browser can encode; resolved once and cached. */
export type EncodableFormats = Record<"jpeg" | "png" | "webp", boolean>;

let encodable: Promise<EncodableFormats> | null = null;

/**
 * Checks which formats `OffscreenCanvas.convertToBlob` really produces. Browsers
 * silently fall back to PNG for unsupported types (e.g. WebP in Safari).
 */
export function detectEncodableFormats(): Promise<EncodableFormats> {
  encodable ??= (async () => {
    const check = async (type: string) => {
      try {
        const canvas = new OffscreenCanvas(1, 1);
        canvas.getContext("2d");
        return (await canvas.convertToBlob({ type })).type === type;
      } catch {
        return false;
      }
    };
    const [jpeg, png, webp] = await Promise.all(
      ["image/jpeg", "image/png", "image/webp"].map(check),
    );
    return { jpeg, png, webp };
  })();
  return encodable;
}
