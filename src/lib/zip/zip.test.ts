import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readZip } from "./testing/read-zip";
import { crc32, createZip } from "./zip";

const jpegLike = (seed: number, length: number) =>
  Uint8Array.from({ length }, (_, i) => (i * 31 + seed * 7) & 0xff);

const ENTRIES = [
  { name: "CCC_Photo_132x170.jpg", data: jpegLike(1, 25_000) },
  { name: "CCC_Signature_170x132.jpg", data: jpegLike(2, 9_000) },
  { name: "CCC_Left_Thumb_170x132.jpg", data: jpegLike(3, 4_300) },
];

describe("crc32", () => {
  it("matches Node's zlib implementation", () => {
    for (const { data } of ENTRIES) expect(crc32(data)).toBe(nodeCrc32(data));
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("createZip", () => {
  it("stores the exact bytes under the given names", () => {
    const entries = readZip(createZip(ENTRIES, new Date(2026, 8, 24, 10, 30)));
    expect(entries.map((e) => e.name)).toEqual(ENTRIES.map((e) => e.name));
    entries.forEach((entry, i) => {
      expect(entry.method).toBe(0);
      expect(entry.data).toEqual(ENTRIES[i].data);
      expect(entry.crc32).toBe(nodeCrc32(ENTRIES[i].data));
    });
  });

  it("rejects duplicate names", () => {
    expect(() => createZip([ENTRIES[0], ENTRIES[0]])).toThrow(/Duplicate/);
  });

  const python = spawnSync("python3", ["--version"]).status === 0;
  it.skipIf(!python)("is readable by an independent ZIP implementation (Python zipfile)", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-test-"));
    const file = join(dir, "pack.zip");
    writeFileSync(file, createZip(ENTRIES));
    const script =
      "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); " +
      "assert z.testzip() is None; print(','.join(f'{i.filename}:{i.file_size}' for i in z.infolist()))";
    const result = spawnSync("python3", ["-c", script, file], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe(ENTRIES.map((e) => `${e.name}:${e.data.length}`).join(","));
  });
});
