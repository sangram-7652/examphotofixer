/**
 * Test support: builds EXIF APP1 segments (little-endian TIFF) with the tags
 * real phone cameras write — orientation, make/model, timestamp, resolution
 * and a GPS IFD. Used by unit tests and the browser test harness only.
 */

export interface ExifFixture {
  orientation?: number;
  gps?: boolean;
  make?: string;
  model?: string;
  dateTime?: string;
  /** EXIF X/YResolution in dots per inch. */
  resolutionDpi?: number;
}

const ASCII = 2;
const SHORT = 3;
const LONG = 4;
const RATIONAL = 5;

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** Little-endian value bytes. ≤ 4 bytes are stored inline. */
  data: number[];
}

const u16 = (value: number) => [value & 0xff, (value >> 8) & 0xff];
const u32 = (value: number) => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
  (value >>> 24) & 0xff,
];
const asciiEntry = (tag: number, text: string): Entry => ({
  tag,
  type: ASCII,
  count: text.length + 1,
  data: [...[...text].map((char) => char.charCodeAt(0)), 0],
});
const rationals = (tag: number, values: [number, number][]): Entry => ({
  tag,
  type: RATIONAL,
  count: values.length,
  data: values.flatMap(([num, den]) => [...u32(num), ...u32(den)]),
});

/** Serialises an IFD at `offset` (relative to TIFF start). Returns its bytes incl. out-of-line data. */
function buildIfd(entries: Entry[], offset: number): number[] {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  const headerSize = 2 + sorted.length * 12 + 4;
  const table: number[] = [...u16(sorted.length)];
  const data: number[] = [];
  for (const entry of sorted) {
    table.push(...u16(entry.tag), ...u16(entry.type), ...u32(entry.count));
    if (entry.data.length <= 4) {
      table.push(...entry.data, ...new Array(4 - entry.data.length).fill(0));
    } else {
      table.push(...u32(offset + headerSize + data.length));
      data.push(...entry.data);
      if (data.length % 2) data.push(0);
    }
  }
  table.push(...u32(0)); // no next IFD
  return [...table, ...data];
}

function ifdSize(entries: Entry[]): number {
  return buildIfd(entries, 0).length;
}

/** Full APP1 segment (FF E1 + length + "Exif\0\0" + TIFF). */
export function buildExifSegment(fixture: ExifFixture): Uint8Array<ArrayBuffer> {
  const ifd0: Entry[] = [];
  if (fixture.make) ifd0.push(asciiEntry(0x010f, fixture.make));
  if (fixture.model) ifd0.push(asciiEntry(0x0110, fixture.model));
  if (fixture.orientation !== undefined) {
    ifd0.push({ tag: 0x0112, type: SHORT, count: 1, data: u16(fixture.orientation) });
  }
  if (fixture.resolutionDpi !== undefined) {
    ifd0.push(rationals(0x011a, [[fixture.resolutionDpi, 1]]));
    ifd0.push(rationals(0x011b, [[fixture.resolutionDpi, 1]]));
    ifd0.push({ tag: 0x0128, type: SHORT, count: 1, data: u16(2) });
  }
  if (fixture.dateTime) ifd0.push(asciiEntry(0x0132, fixture.dateTime));

  const gpsEntries: Entry[] = [
    { tag: 0x0000, type: 1, count: 4, data: [2, 3, 0, 0] }, // GPSVersionID
    asciiEntry(0x0001, "N"),
    rationals(0x0002, [
      [28, 1],
      [36, 1],
      [5000, 100],
    ]),
    asciiEntry(0x0003, "E"),
    rationals(0x0004, [
      [77, 1],
      [12, 1],
      [3000, 100],
    ]),
  ];

  const ifd0Offset = 8;
  let tiffBody: number[];
  if (fixture.gps) {
    const pointer: Entry = { tag: 0x8825, type: LONG, count: 1, data: u32(0) };
    const gpsOffset = ifd0Offset + ifdSize([...ifd0, pointer]);
    pointer.data = u32(gpsOffset);
    tiffBody = [...buildIfd([...ifd0, pointer], ifd0Offset), ...buildIfd(gpsEntries, gpsOffset)];
  } else {
    tiffBody = buildIfd(ifd0, ifd0Offset);
  }

  const tiff = [0x49, 0x49, ...u16(42), ...u32(ifd0Offset), ...tiffBody];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  return new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...payload]);
}

/** Inserts an APP1 EXIF segment right after SOI (where cameras put it). */
export function insertExif(jpeg: Uint8Array, fixture: ExifFixture): Uint8Array<ArrayBuffer> {
  const segment = buildExifSegment(fixture);
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(segment, 2);
  out.set(jpeg.subarray(2), 2 + segment.length);
  return out;
}
