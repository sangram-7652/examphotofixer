import { detectImageFormat, listPngOrWebpMetadata, readPngOrWebpDimensions } from "./formats";
import { listJpegMetadata, readJpegDimensions, readJpegDpi } from "./jpeg";
import type { OutputFacts } from "./pipeline";

/**
 * Reads validation facts from JPEG bytes — never from the settings that were
 * intended. Returns `null` if the bytes aren't a readable JPEG.
 */
export function readJpegFacts(bytes: Uint8Array): OutputFacts | null {
  const format = detectImageFormat(bytes);
  const size = format === "jpeg" ? readJpegDimensions(bytes) : null;
  if (!size) return null;
  return {
    width: size.width,
    height: size.height,
    byteLength: bytes.length,
    format,
    dpi: readJpegDpi(bytes),
    metadata: listJpegMetadata(bytes),
  };
}

/**
 * Facts for any engine output (JPEG, PNG or WebP), read from the bytes.
 * PNG/WebP carry no DPI we write, so `dpi` is `null` for them.
 */
export function readOutputFacts(bytes: Uint8Array): OutputFacts | null {
  const format = detectImageFormat(bytes);
  if (format === "jpeg") return readJpegFacts(bytes);
  if (format !== "png" && format !== "webp") return null;
  const size = readPngOrWebpDimensions(bytes, format);
  if (!size) return null;
  return {
    width: size.width,
    height: size.height,
    byteLength: bytes.length,
    format,
    dpi: null,
    metadata: listPngOrWebpMetadata(bytes, format),
  };
}
