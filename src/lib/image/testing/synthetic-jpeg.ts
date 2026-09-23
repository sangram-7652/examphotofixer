/**
 * Test support: structurally valid JPEG byte streams for Node unit tests.
 * They are not decodable images — only the segment layout is realistic.
 */

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

export interface SyntheticJpegOptions {
  width?: number;
  height?: number;
  /** Extra header segments inserted after SOI, as raw bytes. */
  headerSegments?: Uint8Array[];
  jfif?: { units: number; x: number; y: number; thumbnail?: boolean } | null;
  comment?: string;
  xmp?: boolean;
  icc?: boolean;
  /** Bytes appended after EOI (camera trailers). */
  trailer?: number[];
  /** Omit EOI (truncated file). */
  truncated?: boolean;
  /** Progressive layout: DHT + second SOS between scans. */
  progressive?: boolean;
}

/** Entropy data containing byte stuffing (FF 00) and a restart marker (FF D0). */
const SCAN_DATA = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a];
const SOS_HEADER = segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);

export function buildSyntheticJpeg(options: SyntheticJpegOptions = {}): Uint8Array<ArrayBuffer> {
  const { width = 132, height = 170 } = options;
  const bytes: number[] = [0xff, 0xd8];

  if (options.jfif !== null) {
    const jfif = options.jfif ?? { units: 0, x: 1, y: 1 };
    const thumb = jfif.thumbnail ? [1, 1, 0xff, 0x00, 0x00] : [0, 0];
    bytes.push(
      ...segment(0xe0, [
        ...ascii("JFIF"),
        0,
        1,
        1,
        jfif.units,
        jfif.x >> 8,
        jfif.x & 0xff,
        jfif.y >> 8,
        jfif.y & 0xff,
        ...thumb,
      ]),
    );
  }
  for (const extra of options.headerSegments ?? []) bytes.push(...extra);
  if (options.xmp)
    bytes.push(...segment(0xe1, [...ascii("http://ns.adobe.com/xap/1.0/"), 0, 0x3c]));
  if (options.icc) bytes.push(...segment(0xe2, [...ascii("ICC_PROFILE"), 0, 1, 1, 0]));
  bytes.push(...segment(0xee, [...ascii("Adobe"), 0, 100, 0, 0, 0, 0, 1]));
  if (options.comment) bytes.push(...segment(0xfe, ascii(options.comment)));
  bytes.push(...segment(0xdb, [0x00, ...new Array(64).fill(1)])); // DQT
  bytes.push(
    ...segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]),
  );
  bytes.push(...segment(0xc4, [0x00, ...new Array(16).fill(0)])); // DHT
  bytes.push(...SOS_HEADER, ...SCAN_DATA);
  if (options.progressive) {
    bytes.push(...segment(0xc4, [0x10, 0xff, 0xd9, ...new Array(14).fill(0)])); // DHT containing FF D9
    bytes.push(...SOS_HEADER, ...SCAN_DATA);
  }
  if (!options.truncated) bytes.push(0xff, 0xd9);
  bytes.push(...(options.trailer ?? []));
  return new Uint8Array(bytes);
}
