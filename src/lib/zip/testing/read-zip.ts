/**
 * Test support: independent ZIP reader (walks the central directory, then the
 * local headers). Supports only stored entries — enough to verify createZip.
 */

export interface ReadZipEntry {
  name: string;
  data: Uint8Array;
  crc32: number;
  method: number;
}

export function readZip(bytes: Uint8Array): ReadZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("No end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralOffset + centralSize !== eocd) throw new Error("Central directory size mismatch");

  const decoder = new TextDecoder();
  const entries: ReadZipEntry[] = [];
  let pos = centralOffset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error("Bad central header");
    const method = view.getUint16(pos + 10, true);
    const crc32 = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extra = view.getUint16(pos + 30, true);
    const comment = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Bad local header");
    const localName = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localName + localExtra;
    entries.push({ name, data: bytes.slice(start, start + size), crc32, method });
    pos += 46 + nameLength + extra + comment;
  }
  return entries;
}
