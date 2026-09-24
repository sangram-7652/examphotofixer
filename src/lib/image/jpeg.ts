/**
 * Byte-level JPEG utilities: segment parsing, dimensions, JFIF density (DPI),
 * metadata inspection and stripping. Pure functions over Uint8Array; no DOM.
 *
 * Only the header segments before the first SOS are rewritten. Entropy-coded
 * image data is copied verbatim, so pixels are never altered.
 */

import { isExifPayload, parseExifPayload } from "./exif";

export class JpegFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JpegFormatError";
  }
}

export interface JpegSegment {
  marker: number;
  /** Offset of the 0xFF that starts the marker. */
  offset: number;
  /** Total bytes including marker and length field. */
  length: number;
  payloadOffset: number;
  payloadLength: number;
}

export interface JpegStructure {
  /** Header segments between SOI and the first SOS (SOI itself excluded). */
  segments: JpegSegment[];
  /** Offset of the first SOS marker; image data runs from here. */
  scanOffset: number;
}

export type MetadataKind =
  "exif" | "gps" | "xmp" | "icc" | "iptc" | "comment" | "jfif-thumbnail" | "other-app";

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP13 = 0xed;
const APP14 = 0xee;
const COM = 0xfe;

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const JFIF_ID = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF\0"
const JFXX_ID = [0x4a, 0x46, 0x58, 0x58, 0x00]; // "JFXX\0"
const XMP_ID = "http://ns.adobe.com/xap/1.0/\0";
const ICC_ID = "ICC_PROFILE\0";
const ADOBE_ID = "Adobe";

const MAX_DENSITY = 0xffff;

function startsWith(bytes: Uint8Array, offset: number, id: readonly number[] | string): boolean {
  const codes = typeof id === "string" ? [...id].map((char) => char.charCodeAt(0)) : id;
  if (offset + codes.length > bytes.length) return false;
  return codes.every((code, index) => bytes[offset + index] === code);
}

function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function isApp(marker: number): boolean {
  return marker >= 0xe0 && marker <= 0xef;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === SOI && bytes[2] === 0xff;
}

/** Parses header segments up to the first SOS. Throws `JpegFormatError` on malformed input. */
export function parseJpeg(bytes: Uint8Array): JpegStructure {
  if (!(bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === SOI)) {
    throw new JpegFormatError("Missing JPEG start-of-image marker");
  }
  const segments: JpegSegment[] = [];
  let pos = 2;

  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) throw new JpegFormatError(`Expected marker at byte ${pos}`);
    const offset = pos;
    while (pos < bytes.length && bytes[pos] === 0xff) pos++; // fill bytes
    if (pos >= bytes.length) break;
    const marker = bytes[pos++];

    if (marker === SOI || isStandalone(marker)) continue;
    if (marker === EOI) throw new JpegFormatError("End of image before any image data");
    if (pos + 2 > bytes.length) break;

    const length = (bytes[pos] << 8) | bytes[pos + 1];
    if (length < 2) throw new JpegFormatError(`Invalid segment length at byte ${pos}`);
    const end = pos + length;
    if (end > bytes.length) throw new JpegFormatError("Segment runs past end of file");

    if (marker === SOS) return { segments, scanOffset: offset };
    segments.push({
      marker,
      offset,
      length: end - offset,
      payloadOffset: pos + 2,
      payloadLength: length - 2,
    });
    pos = end;
  }
  throw new JpegFormatError("No image data found (truncated file)");
}

/**
 * Offset just past the EOI marker, walking scan data correctly (byte stuffing,
 * restart markers, and the extra DHT/SOS segments of progressive JPEGs).
 * Returns -1 when the file is truncated.
 */
export function findJpegEnd(bytes: Uint8Array, scanOffset: number): number {
  let pos = scanOffset;
  const n = bytes.length;
  while (pos + 1 < n) {
    // At a marker with a length field (SOS, DHT, DQT, DRI, ...): skip its header.
    if (bytes[pos] !== 0xff) return -1;
    while (pos + 2 < n && bytes[pos + 1] === 0xff) pos++; // fill bytes
    const marker = bytes[pos + 1];
    if (marker === EOI) return pos + 2;
    if (pos + 4 > n) return -1;
    pos += 2 + ((bytes[pos + 2] << 8) | bytes[pos + 3]);

    // Entropy-coded data until the next real marker.
    while (pos + 1 < n) {
      if (bytes[pos] !== 0xff) {
        pos++;
        continue;
      }
      const next = bytes[pos + 1];
      if (next === 0x00 || isStandalone(next)) {
        pos += 2;
      } else if (next === 0xff) {
        pos += 1;
      } else if (next === EOI) {
        return pos + 2;
      } else {
        break; // another segment (progressive): handled by the outer loop
      }
    }
  }
  return -1;
}

const DQT = 0xdb;

/**
 * True when the file has a frame header (SOF), quantization tables (DQT, which
 * have no defaults in the JPEG standard) and reaches an EOI marker. Some
 * decoders (WebKit) silently render files missing these; we reject them.
 */
export function isCompleteJpeg(bytes: Uint8Array): boolean {
  try {
    const { segments, scanOffset } = parseJpeg(bytes);
    const hasFrame = segments.some((segment) => SOF_MARKERS.has(segment.marker));
    const hasTables = segments.some((segment) => segment.marker === DQT);
    return hasFrame && hasTables && findJpegEnd(bytes, scanOffset) !== -1;
  } catch {
    return false;
  }
}

/** Pixel dimensions from the SOF segment, or `null`. */
export function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  try {
    const { segments } = parseJpeg(bytes);
    const sof = segments.find((segment) => SOF_MARKERS.has(segment.marker));
    if (!sof || sof.payloadLength < 5) return null;
    const p = sof.payloadOffset;
    const height = (bytes[p + 1] << 8) | bytes[p + 2];
    const width = (bytes[p + 3] << 8) | bytes[p + 4];
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

function findExifSegment(bytes: Uint8Array, segments: JpegSegment[]): JpegSegment | undefined {
  return segments.find(
    (segment) =>
      segment.marker === APP1 &&
      isExifPayload(bytes.subarray(segment.payloadOffset, segment.payloadOffset + 6)),
  );
}

function exifSummary(bytes: Uint8Array, segments: JpegSegment[]) {
  const exif = findExifSegment(bytes, segments);
  return exif
    ? parseExifPayload(bytes.subarray(exif.payloadOffset, exif.payloadOffset + exif.payloadLength))
    : null;
}

/** EXIF orientation (1–8). Defaults to 1 when absent, invalid or unreadable. */
export function readJpegOrientation(bytes: Uint8Array): number {
  try {
    return exifSummary(bytes, parseJpeg(bytes).segments)?.orientation ?? 1;
  } catch {
    return 1;
  }
}

function isJfif(bytes: Uint8Array, segment: JpegSegment): boolean {
  return (
    segment.marker === APP0 &&
    segment.payloadLength >= 14 &&
    startsWith(bytes, segment.payloadOffset, JFIF_ID)
  );
}

/**
 * Reads DPI. JFIF density takes precedence; falls back to EXIF resolution.
 * Returns `null` when the file carries no absolute density (JFIF units = 0).
 */
export function readJpegDpi(bytes: Uint8Array): { x: number; y: number } | null {
  let segments: JpegSegment[];
  try {
    segments = parseJpeg(bytes).segments;
  } catch {
    return null;
  }
  const jfif = segments.find((segment) => isJfif(bytes, segment));
  if (jfif) {
    const p = jfif.payloadOffset;
    const units = bytes[p + 7];
    const x = (bytes[p + 8] << 8) | bytes[p + 9];
    const y = (bytes[p + 10] << 8) | bytes[p + 11];
    if (units === 1 && x > 0 && y > 0) return { x, y };
    if (units === 2 && x > 0 && y > 0) {
      return { x: Math.round(x * 2.54), y: Math.round(y * 2.54) };
    }
  }
  return exifSummary(bytes, segments)?.dpi ?? null;
}

/** Non-essential metadata present in the file, de-duplicated and sorted. */
export function listJpegMetadata(bytes: Uint8Array): MetadataKind[] {
  let segments: JpegSegment[];
  try {
    segments = parseJpeg(bytes).segments;
  } catch {
    return [];
  }
  const found = new Set<MetadataKind>();
  for (const segment of segments) {
    const p = segment.payloadOffset;
    if (segment.marker === APP0) {
      if (isJfif(bytes, segment)) {
        if (bytes[p + 12] * bytes[p + 13] > 0) found.add("jfif-thumbnail");
      } else if (startsWith(bytes, p, JFXX_ID)) {
        found.add("jfif-thumbnail");
      } else {
        found.add("other-app");
      }
    } else if (segment.marker === APP1) {
      if (isExifPayload(bytes.subarray(p, p + 6))) {
        found.add("exif");
        const summary = parseExifPayload(bytes.subarray(p, p + segment.payloadLength));
        if (summary.hasGps) found.add("gps");
      } else if (startsWith(bytes, p, XMP_ID)) {
        found.add("xmp");
      } else {
        found.add("other-app");
      }
    } else if (segment.marker === APP2 && startsWith(bytes, p, ICC_ID)) {
      found.add("icc");
    } else if (segment.marker === APP13) {
      found.add("iptc");
    } else if (segment.marker === COM) {
      found.add("comment");
    } else if (isApp(segment.marker) && !isAdobe(bytes, segment)) {
      found.add("other-app");
    }
  }
  return [...found].sort();
}

function isAdobe(bytes: Uint8Array, segment: JpegSegment): boolean {
  return segment.marker === APP14 && startsWith(bytes, segment.payloadOffset, ADOBE_ID);
}

function assertDpi(dpi: number): void {
  if (!Number.isInteger(dpi) || dpi < 1 || dpi > MAX_DENSITY) {
    throw new RangeError(`DPI must be an integer between 1 and ${MAX_DENSITY}`);
  }
}

/** A JFIF 1.01 APP0 segment with absolute density in dots per inch and no thumbnail. */
export function buildJfifSegment(dpi: number): Uint8Array<ArrayBuffer> {
  assertDpi(dpi);
  return new Uint8Array([
    0xff,
    APP0,
    0x00,
    0x10,
    ...JFIF_ID,
    0x01,
    0x01, // version 1.01
    0x01, // units: dots per inch
    dpi >> 8,
    dpi & 0xff,
    dpi >> 8,
    dpi & 0xff,
    0x00,
    0x00, // no thumbnail
  ]);
}

interface RebuildOptions {
  dpi: number;
  /** Remove all metadata except the JFIF density and the Adobe colour-transform marker. */
  stripMetadata: boolean;
}

function rebuildJpeg(bytes: Uint8Array, { dpi, stripMetadata }: RebuildOptions) {
  const { segments, scanOffset } = parseJpeg(bytes);
  const end = stripMetadata ? findJpegEnd(bytes, scanOffset) : bytes.length;
  if (end === -1) throw new JpegFormatError("Image data is truncated");

  const keep = segments.filter((segment) => {
    if (isJfif(bytes, segment)) return false; // replaced by a fresh JFIF segment
    if (!stripMetadata) return true;
    if (segment.marker === COM) return false;
    if (isApp(segment.marker)) return isAdobe(bytes, segment);
    return true;
  });

  const jfif = buildJfifSegment(dpi);
  const scanLength = end - scanOffset;
  const size = 2 + jfif.length + keep.reduce((sum, s) => sum + s.length, 0) + scanLength;
  const out = new Uint8Array(size);
  out[0] = 0xff;
  out[1] = SOI;
  out.set(jfif, 2);
  let pos = 2 + jfif.length;
  for (const segment of keep) {
    out.set(bytes.subarray(segment.offset, segment.offset + segment.length), pos);
    pos += segment.length;
  }
  out.set(bytes.subarray(scanOffset, end), pos);
  return out;
}

/** Returns a copy with JFIF density set to `dpi`. Other segments are preserved. */
export function writeJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  return rebuildJpeg(bytes, { dpi, stripMetadata: false });
}

/**
 * Returns a copy containing only what decoding needs plus JFIF density:
 * removes EXIF (incl. GPS, camera, timestamps), XMP, ICC, IPTC, comments,
 * thumbnails, vendor APP segments and any trailer after EOI.
 */
export function finalizeJpeg(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  return rebuildJpeg(bytes, { dpi, stripMetadata: true });
}

/**
 * Removes EXIF APP1 segments only. Used before decoding so the browser cannot
 * apply orientation itself — the pipeline applies it explicitly.
 */
export function removeExifSegments(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const { segments } = parseJpeg(bytes);
  const exif = segments.filter(
    (segment) =>
      segment.marker === APP1 &&
      isExifPayload(bytes.subarray(segment.payloadOffset, segment.payloadOffset + 6)),
  );
  const removed = exif.reduce((sum, segment) => sum + segment.length, 0);
  const out = new Uint8Array(bytes.length - removed);
  let read = 0;
  let write = 0;
  for (const segment of exif) {
    out.set(bytes.subarray(read, segment.offset), write);
    write += segment.offset - read;
    read = segment.offset + segment.length;
  }
  out.set(bytes.subarray(read), write);
  return out;
}
