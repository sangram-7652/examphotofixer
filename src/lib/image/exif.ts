/**
 * Minimal, defensive EXIF (TIFF) reader. Reads only what the pipeline needs:
 * orientation, GPS presence and resolution. Never throws on malformed data.
 */

export interface ExifSummary {
  /** Raw orientation tag value (1–8), or `null` if absent/invalid. */
  orientation: number | null;
  hasGps: boolean;
  /** DPI derived from X/YResolution + ResolutionUnit, or `null` if absent. */
  dpi: { x: number; y: number } | null;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

const TAG_ORIENTATION = 0x0112;
const TAG_X_RESOLUTION = 0x011a;
const TAG_Y_RESOLUTION = 0x011b;
const TAG_RESOLUTION_UNIT = 0x0128;
const TAG_GPS_IFD = 0x8825;

const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

const EMPTY: ExifSummary = { orientation: null, hasGps: false, dpi: null };

/** True if an APP1 payload starts with the EXIF identifier. */
export function isExifPayload(payload: Uint8Array): boolean {
  return EXIF_HEADER.every((byte, index) => payload[index] === byte);
}

/** Parses an APP1 payload (starting with "Exif\0\0"). */
export function parseExifPayload(payload: Uint8Array): ExifSummary {
  if (!isExifPayload(payload) || payload.length < EXIF_HEADER.length + 8) return EMPTY;

  const tiffStart = EXIF_HEADER.length;
  const view = new DataView(
    payload.buffer,
    payload.byteOffset + tiffStart,
    payload.length - tiffStart,
  );
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return EMPTY;
  const little = order === 0x4949;
  if (view.getUint16(2, little) !== 42) return EMPTY;

  const inBounds = (offset: number, length: number) =>
    offset >= 0 && offset + length <= view.byteLength;

  const ifdOffset = view.getUint32(4, little);
  if (!inBounds(ifdOffset, 2)) return EMPTY;
  const count = view.getUint16(ifdOffset, little);

  let orientation: number | null = null;
  let hasGps = false;
  let xRes: number | null = null;
  let yRes: number | null = null;
  let unit = 2; // EXIF default: inches

  const readRational = (entry: number): number | null => {
    const offset = view.getUint32(entry + 8, little);
    if (!inBounds(offset, 8)) return null;
    const numerator = view.getUint32(offset, little);
    const denominator = view.getUint32(offset + 4, little);
    return denominator === 0 ? null : numerator / denominator;
  };

  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (!inBounds(entry, 12)) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);

    if (tag === TAG_ORIENTATION && type === TYPE_SHORT) {
      const value = view.getUint16(entry + 8, little);
      orientation = value >= 1 && value <= 8 ? value : null;
    } else if (tag === TAG_GPS_IFD && (type === TYPE_LONG || type === 13)) {
      hasGps = view.getUint32(entry + 8, little) !== 0;
    } else if (tag === TAG_X_RESOLUTION && type === TYPE_RATIONAL) {
      xRes = readRational(entry);
    } else if (tag === TAG_Y_RESOLUTION && type === TYPE_RATIONAL) {
      yRes = readRational(entry);
    } else if (tag === TAG_RESOLUTION_UNIT && type === TYPE_SHORT) {
      unit = view.getUint16(entry + 8, little);
    }
  }

  let dpi: ExifSummary["dpi"] = null;
  if (xRes !== null && yRes !== null && (unit === 2 || unit === 3)) {
    const factor = unit === 3 ? 2.54 : 1;
    dpi = { x: Math.round(xRes * factor), y: Math.round(yRes * factor) };
  }

  return { orientation, hasGps, dpi };
}
