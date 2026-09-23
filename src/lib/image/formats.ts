/**
 * File-format detection from magic bytes. The browser-reported MIME type and
 * file extension are hints only; decisions are made from file contents.
 */

export type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "bmp" | "heic";

export const FORMAT_LABELS: Readonly<Record<ImageFormat, string>> = {
  jpeg: "JPG/JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  bmp: "BMP",
  heic: "HEIC/HEIF",
};

/** Formats the browser can decode reliably and V1 accepts as input. */
export const SUPPORTED_INPUT_FORMATS: readonly ImageFormat[] = ["jpeg", "png", "webp"];

/** Number of leading bytes `detectImageFormat` needs. */
export const FORMAT_SNIFF_BYTES = 16;

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return "gif";
  }
  if (bytes.length >= 2 && ascii(bytes, 0, 2) === "BM") {
    return "bmp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 4))) {
    return "heic";
  }
  return null;
}
