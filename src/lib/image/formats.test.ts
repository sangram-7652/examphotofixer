import { describe, expect, it } from "vitest";
import { detectImageFormat } from "./formats";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [value],
    ),
  );

describe("detectImageFormat", () => {
  it.each([
    ["jpeg", bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, "JFIF")],
    ["png", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d)],
    ["webp", bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 ")],
    ["gif", bytes("GIF89a", 1, 0)],
    ["bmp", bytes("BM", 0, 0, 0, 0)],
    ["heic", bytes(0, 0, 0, 0x18, "ftypheic", 0, 0, 0, 0)],
  ])("detects %s", (format, input) => {
    expect(detectImageFormat(input)).toBe(format);
  });

  it("returns null for unknown or empty data", () => {
    expect(detectImageFormat(new Uint8Array())).toBeNull();
    expect(detectImageFormat(bytes("%PDF-1.7"))).toBeNull();
    expect(detectImageFormat(bytes(0xff, 0xd8))).toBeNull();
  });
});
