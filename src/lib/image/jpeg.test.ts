import { describe, expect, it } from "vitest";
import {
  JpegFormatError,
  finalizeJpeg,
  findJpegEnd,
  isCompleteJpeg,
  listJpegMetadata,
  parseJpeg,
  readJpegDimensions,
  readJpegDpi,
  readJpegOrientation,
  removeExifSegments,
  writeJpegDpi,
} from "./jpeg";
import { buildExifSegment } from "./testing/exif-builder";
import { buildSyntheticJpeg } from "./testing/synthetic-jpeg";

const cameraExif = buildExifSegment({
  orientation: 6,
  gps: true,
  make: "PhoneCo",
  model: "Camera X",
  dateTime: "2026:09:24 10:00:00",
  resolutionDpi: 72,
});

/** Bytes from the first SOS to EOI — the image data that must never change. */
function imageData(bytes: Uint8Array): number[] {
  const { scanOffset } = parseJpeg(bytes);
  return [...bytes.subarray(scanOffset, findJpegEnd(bytes, scanOffset))];
}

const contains = (bytes: Uint8Array, text: string) =>
  Buffer.from(bytes).includes(Buffer.from(text, "latin1"));

describe("parseJpeg", () => {
  it("rejects non-JPEG and truncated headers", () => {
    expect(() => parseJpeg(new Uint8Array([0x89, 0x50]))).toThrow(JpegFormatError);
    expect(() => parseJpeg(buildSyntheticJpeg().subarray(0, 30))).toThrow(JpegFormatError);
  });

  it("reads dimensions from SOF", () => {
    expect(readJpegDimensions(buildSyntheticJpeg({ width: 4000, height: 3000 }))).toEqual({
      width: 4000,
      height: 3000,
    });
  });
});

describe("findJpegEnd / isCompleteJpeg", () => {
  it("finds EOI past byte stuffing and restart markers", () => {
    const bytes = buildSyntheticJpeg();
    expect(findJpegEnd(bytes, parseJpeg(bytes).scanOffset)).toBe(bytes.length);
  });

  it("handles progressive files with extra tables between scans", () => {
    const bytes = buildSyntheticJpeg({ progressive: true });
    expect(findJpegEnd(bytes, parseJpeg(bytes).scanOffset)).toBe(bytes.length);
  });

  it("detects truncated files", () => {
    expect(isCompleteJpeg(buildSyntheticJpeg({ truncated: true }))).toBe(false);
    expect(isCompleteJpeg(buildSyntheticJpeg())).toBe(true);
  });
});

describe("DPI", () => {
  it("write 150 DPI → read returns 150 DPI", () => {
    const written = writeJpegDpi(buildSyntheticJpeg(), 150);
    expect(readJpegDpi(written)).toEqual({ x: 150, y: 150 });
  });

  it("overwrites existing density and keeps pixel dimensions and image data", () => {
    const original = buildSyntheticJpeg({ jfif: { units: 1, x: 72, y: 72 } });
    const written = writeJpegDpi(original, 200);
    expect(readJpegDpi(original)).toEqual({ x: 72, y: 72 });
    expect(readJpegDpi(written)).toEqual({ x: 200, y: 200 });
    expect(readJpegDimensions(written)).toEqual(readJpegDimensions(original));
    expect(imageData(written)).toEqual(imageData(original));
  });

  it("adds a JFIF segment when the file has none", () => {
    const written = writeJpegDpi(buildSyntheticJpeg({ jfif: null }), 96);
    expect(readJpegDpi(written)).toEqual({ x: 96, y: 96 });
  });

  it("converts dots-per-cm and ignores aspect-only density", () => {
    expect(readJpegDpi(buildSyntheticJpeg({ jfif: { units: 2, x: 59, y: 59 } }))).toEqual({
      x: 150,
      y: 150,
    });
    expect(readJpegDpi(buildSyntheticJpeg({ jfif: { units: 0, x: 1, y: 1 } }))).toBeNull();
  });

  it("falls back to EXIF resolution when JFIF has no density", () => {
    const bytes = buildSyntheticJpeg({ headerSegments: [cameraExif] });
    expect(readJpegDpi(bytes)).toEqual({ x: 72, y: 72 });
  });

  it("rejects invalid DPI values", () => {
    expect(() => writeJpegDpi(buildSyntheticJpeg(), 0)).toThrow(RangeError);
    expect(() => writeJpegDpi(buildSyntheticJpeg(), 150.5)).toThrow(RangeError);
    expect(() => writeJpegDpi(buildSyntheticJpeg(), 70_000)).toThrow(RangeError);
  });
});

describe("metadata", () => {
  const camera = buildSyntheticJpeg({
    headerSegments: [cameraExif],
    jfif: { units: 0, x: 1, y: 1, thumbnail: true },
    xmp: true,
    icc: true,
    comment: "Shot on PhoneCo",
    trailer: [0x4d, 0x4f, 0x54, 0x49, 0x4f, 0x4e], // "MOTION" vendor trailer
  });

  it("lists every kind of non-essential metadata", () => {
    expect(listJpegMetadata(camera)).toEqual([
      "comment",
      "exif",
      "gps",
      "icc",
      "jfif-thumbnail",
      "xmp",
    ]);
  });

  it("finalizeJpeg removes GPS, camera, timestamp, XMP, ICC, comments, thumbnail and trailer", () => {
    const clean = finalizeJpeg(camera, 150);
    expect(listJpegMetadata(clean)).toEqual([]);
    for (const text of [
      "Exif",
      "PhoneCo",
      "Camera X",
      "2026:09:24",
      "ns.adobe.com",
      "ICC_PROFILE",
      "MOTION",
    ]) {
      expect(contains(clean, text), text).toBe(false);
    }
    expect(readJpegDpi(clean)).toEqual({ x: 150, y: 150 });
    expect(readJpegOrientation(clean)).toBe(1);
  });

  it("finalizeJpeg keeps the image data byte-for-byte", () => {
    expect(imageData(finalizeJpeg(camera, 150))).toEqual(imageData(camera));
    expect(readJpegDimensions(finalizeJpeg(camera, 150))).toEqual({ width: 132, height: 170 });
  });

  it("keeps the Adobe colour-transform segment (needed for correct colours)", () => {
    expect(contains(finalizeJpeg(camera, 150), "Adobe")).toBe(true);
  });

  it("removeExifSegments removes only EXIF", () => {
    const stripped = removeExifSegments(camera);
    expect(listJpegMetadata(stripped)).toEqual(["comment", "icc", "jfif-thumbnail", "xmp"]);
    expect(readJpegOrientation(camera)).toBe(6);
    expect(readJpegOrientation(stripped)).toBe(1);
  });

  it("refuses to finalize truncated image data", () => {
    expect(() => finalizeJpeg(buildSyntheticJpeg({ truncated: true }), 150)).toThrow(
      JpegFormatError,
    );
  });
});
