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

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

interface PngChunk {
  type: string;
  offset: number;
  length: number;
}

/** Iterates PNG chunks; stops at the first chunk that runs past the end. */
function* pngChunks(bytes: Uint8Array): Generator<PngChunk> {
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const length = u32be(bytes, pos);
    const type = ascii(bytes, pos + 4, 4);
    if (pos + 12 + length > bytes.length) return;
    yield { type, offset: pos, length };
    pos += 12 + length;
  }
}

interface RiffChunk {
  id: string;
  offset: number;
  size: number;
}

function* webpChunks(bytes: Uint8Array): Generator<RiffChunk> {
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = ascii(bytes, pos, 4);
    const size =
      (bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24)) >>>
      0;
    yield { id, offset: pos, size };
    pos += 8 + size + (size % 2);
  }
}

/** Pixel dimensions read from the PNG/WebP header (JPEG: see `readJpegDimensions`). */
export function readPngOrWebpDimensions(
  bytes: Uint8Array,
  format: "png" | "webp",
): { width: number; height: number } | null {
  if (format === "png") {
    if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
    const width = u32be(bytes, 16);
    const height = u32be(bytes, 20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  for (const chunk of webpChunks(bytes)) {
    const p = chunk.offset + 8;
    if (chunk.id === "VP8X" && p + 10 <= bytes.length) {
      return { width: u24le(bytes, p + 4) + 1, height: u24le(bytes, p + 7) + 1 };
    }
    if (chunk.id === "VP8 " && p + 10 <= bytes.length) {
      if (bytes[p + 3] !== 0x9d || bytes[p + 4] !== 0x01 || bytes[p + 5] !== 0x2a) return null;
      const width = (bytes[p + 6] | (bytes[p + 7] << 8)) & 0x3fff;
      const height = (bytes[p + 8] | (bytes[p + 9] << 8)) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunk.id === "VP8L" && p + 5 <= bytes.length) {
      if (bytes[p] !== 0x2f) return null;
      const bits = bytes[p + 1] | (bytes[p + 2] << 8) | (bytes[p + 3] << 16) | (bytes[p + 4] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/** True for animated PNG (APNG) and animated WebP. Animated inputs are rejected. */
export function isAnimatedImage(bytes: Uint8Array, format: ImageFormat): boolean {
  if (format === "gif") return true; // GIF is unsupported regardless; treat as animated-capable
  if (format === "png") {
    for (const chunk of pngChunks(bytes)) {
      if (chunk.type === "acTL") return true;
      if (chunk.type === "IDAT") return false;
    }
    return false;
  }
  if (format === "webp") {
    for (const chunk of webpChunks(bytes)) {
      if (chunk.id === "VP8X") return (bytes[chunk.offset + 8] & 0x02) !== 0;
      if (chunk.id === "ANIM" || chunk.id === "ANMF") return true;
    }
  }
  return false;
}

/** Structural completeness for PNG/WebP: catches truncated downloads before decoding. */
export function isCompletePngOrWebp(bytes: Uint8Array, format: "png" | "webp"): boolean {
  if (format === "png") {
    for (const chunk of pngChunks(bytes)) {
      if (chunk.type === "IEND") return true;
    }
    return false;
  }
  const riffSize = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
  return bytes.length >= 12 && riffSize + 8 <= bytes.length;
}

/**
 * Whether the file declares an alpha channel (it *may* contain transparency).
 * Header-level only, so it's cheap: PNG colour types 4/6 or a tRNS chunk;
 * WebP VP8X alpha flag or a VP8L alpha hint. JPEG never has alpha.
 */
export function mayHaveTransparency(bytes: Uint8Array, format: ImageFormat): boolean {
  if (format === "png") {
    const colorType = bytes.length > 25 ? bytes[25] : 0;
    if (colorType === 4 || colorType === 6) return true;
    for (const chunk of pngChunks(bytes)) {
      if (chunk.type === "tRNS") return true;
      if (chunk.type === "IDAT") return false;
    }
    return false;
  }
  if (format === "webp") {
    for (const chunk of webpChunks(bytes)) {
      const p = chunk.offset + 8;
      if (chunk.id === "VP8X") return (bytes[p] & 0x10) !== 0;
      if (chunk.id === "VP8L" && p + 5 <= bytes.length) return (bytes[p + 4] & 0x10) !== 0;
      if (chunk.id === "VP8 ") return false;
    }
  }
  return false;
}

/** Non-essential metadata chunks in a PNG or WebP file (same vocabulary as JPEG). */
export function listPngOrWebpMetadata(
  bytes: Uint8Array,
  format: "png" | "webp",
): ("exif" | "xmp" | "icc" | "comment" | "other-app")[] {
  const found = new Set<"exif" | "xmp" | "icc" | "comment" | "other-app">();
  if (format === "png") {
    for (const chunk of pngChunks(bytes)) {
      if (chunk.type === "eXIf") found.add("exif");
      else if (chunk.type === "iCCP") found.add("icc");
      else if (
        chunk.type === "iTXt" &&
        ascii(bytes, chunk.offset + 8, 17) === "XML:com.adobe.xmp"
      ) {
        found.add("xmp");
      } else if (chunk.type === "tEXt" || chunk.type === "zTXt" || chunk.type === "iTXt") {
        found.add("comment");
      } else if (chunk.type === "tIME") found.add("other-app");
    }
  } else {
    for (const chunk of webpChunks(bytes)) {
      if (chunk.id === "EXIF") found.add("exif");
      else if (chunk.id === "XMP ") found.add("xmp");
      else if (chunk.id === "ICCP") found.add("icc");
    }
  }
  return [...found].sort();
}

const PNG_METADATA_CHUNKS = new Set(["eXIf", "iCCP", "tEXt", "zTXt", "iTXt", "tIME"]);
const WEBP_METADATA_CHUNKS = new Set(["EXIF", "XMP ", "ICCP"]);
/** VP8X flag bits for ICC (0x20), EXIF (0x08) and XMP (0x04). */
const VP8X_METADATA_FLAGS = 0x20 | 0x08 | 0x04;

/**
 * PNG/WebP counterpart of `finalizeJpeg`: removes EXIF, XMP, colour-profile,
 * text and time chunks (browser encoders add an sRGB profile; canvas pixels are
 * already sRGB). Image data chunks are copied byte-for-byte.
 */
export function stripPngOrWebpMetadata(
  bytes: Uint8Array,
  format: "png" | "webp",
): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [];
  if (format === "png") {
    parts.push(bytes.subarray(0, 8));
    for (const chunk of pngChunks(bytes)) {
      if (!PNG_METADATA_CHUNKS.has(chunk.type)) {
        parts.push(bytes.subarray(chunk.offset, chunk.offset + 12 + chunk.length));
      }
    }
  } else {
    parts.push(bytes.subarray(0, 12));
    for (const chunk of webpChunks(bytes)) {
      if (WEBP_METADATA_CHUNKS.has(chunk.id)) continue;
      const end = Math.min(bytes.length, chunk.offset + 8 + chunk.size + (chunk.size % 2));
      parts.push(bytes.subarray(chunk.offset, end));
    }
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  if (format === "webp") {
    const riffSize = out.length - 8;
    out[4] = riffSize & 0xff;
    out[5] = (riffSize >> 8) & 0xff;
    out[6] = (riffSize >> 16) & 0xff;
    out[7] = (riffSize >>> 24) & 0xff;
    if (ascii(out, 12, 4) === "VP8X") out[20] &= ~VP8X_METADATA_FLAGS;
  }
  return out;
}
