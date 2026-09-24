/**
 * Minimal ZIP writer (STORE method, no compression). JPEGs don't compress
 * further, so storing keeps the exact processed bytes and needs no library.
 * Pure: runs in the browser and in Node tests. Limits: < 4 GB, ≤ 65535 files.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time used in ZIP headers (local time, 2-second resolution). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZip(
  entries: readonly ZipEntry[],
  modified: Date = new Date(),
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modified);
  const names = entries.map((entry) => encoder.encode(entry.name));
  if (new Set(entries.map((entry) => entry.name)).size !== entries.length) {
    throw new Error("Duplicate file names in ZIP");
  }

  const localSize = entries.reduce(
    (sum, entry, i) => sum + 30 + names[i].length + entry.data.length,
    0,
  );
  const centralSize = names.reduce((sum, name) => sum + 46 + name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let pos = 0;
  const u16 = (value: number) => {
    view.setUint16(pos, value, true);
    pos += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(pos, value, true);
    pos += 4;
  };

  const offsets: number[] = [];
  const crcs = entries.map((entry) => crc32(entry.data));
  entries.forEach((entry, i) => {
    offsets.push(pos);
    u32(0x04034b50); // local file header
    u16(20); // version needed
    u16(0x0800); // UTF-8 names
    u16(0); // stored
    u16(time);
    u16(date);
    u32(crcs[i]);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(names[i].length);
    u16(0);
    out.set(names[i], pos);
    pos += names[i].length;
    out.set(entry.data, pos);
    pos += entry.data.length;
  });

  const centralStart = pos;
  entries.forEach((entry, i) => {
    u32(0x02014b50); // central directory header
    u16(20); // version made by
    u16(20);
    u16(0x0800);
    u16(0);
    u16(time);
    u16(date);
    u32(crcs[i]);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(names[i].length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(offsets[i]);
    out.set(names[i], pos);
    pos += names[i].length;
  });

  const centralEnd = pos;
  u32(0x06054b50); // end of central directory
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(centralEnd - centralStart);
  u32(centralStart);
  u16(0);
  return out;
}
