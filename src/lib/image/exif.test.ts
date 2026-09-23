import { describe, expect, it } from "vitest";
import { parseExifPayload } from "./exif";
import { buildExifSegment } from "./testing/exif-builder";

const payloadOf = (segment: Uint8Array) => segment.subarray(4);

describe("parseExifPayload", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("reads orientation %i", (orientation) => {
    expect(parseExifPayload(payloadOf(buildExifSegment({ orientation }))).orientation).toBe(
      orientation,
    );
  });

  it("detects GPS and resolution alongside camera tags", () => {
    const summary = parseExifPayload(
      payloadOf(
        buildExifSegment({
          orientation: 6,
          gps: true,
          make: "PhoneCo",
          model: "Camera X",
          dateTime: "2026:09:24 10:00:00",
          resolutionDpi: 72,
        }),
      ),
    );
    expect(summary).toEqual({ orientation: 6, hasGps: true, dpi: { x: 72, y: 72 } });
  });

  it("reads big-endian (Motorola) TIFF", () => {
    // "Exif\0\0" MM 42, IFD0 at 8, one entry: Orientation SHORT 1 = 8
    const payload = new Uint8Array([
      0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0,
      1, 0, 8, 0, 0, 0, 0, 0, 0,
    ]);
    expect(parseExifPayload(payload).orientation).toBe(8);
  });

  it("returns defaults for invalid or truncated data instead of throwing", () => {
    const valid = payloadOf(buildExifSegment({ orientation: 6 }));
    expect(parseExifPayload(valid.subarray(0, 12))).toEqual({
      orientation: null,
      hasGps: false,
      dpi: null,
    });
    expect(parseExifPayload(new Uint8Array([1, 2, 3])).orientation).toBeNull();
    expect(
      parseExifPayload(payloadOf(buildExifSegment({ orientation: 9 }))).orientation,
    ).toBeNull();
  });
});
