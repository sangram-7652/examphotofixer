import { detectImageFormat } from "./formats";
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
