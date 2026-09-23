import { describe, expect, it } from "vitest";
import {
  detectImageFormat,
  isAnimatedImage,
  isCompletePngOrWebp,
  readPngOrWebpDimensions,
} from "./formats";

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

describe("PNG/WebP header helpers", () => {
  const png = (chunks: [string, number[]][]) =>
    bytes(
      0x89,
      "PNG",
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...chunks.flatMap(([type, data]) => [
        0,
        0,
        (data.length >> 8) & 0xff,
        data.length & 0xff,
        type,
        ...data,
        0,
        0,
        0,
        0,
      ]),
    );
  const ihdr: [string, number[]] = ["IHDR", [0, 0, 0x0f, 0xa0, 0, 0, 0x0b, 0xb8, 8, 6, 0, 0, 0]];

  it("reads PNG dimensions and completeness", () => {
    const complete = png([ihdr, ["IDAT", [1, 2]], ["IEND", []]]);
    expect(readPngOrWebpDimensions(complete, "png")).toEqual({ width: 4000, height: 3000 });
    expect(isCompletePngOrWebp(complete, "png")).toBe(true);
    expect(isCompletePngOrWebp(png([ihdr, ["IDAT", [1, 2]]]), "png")).toBe(false);
  });

  it("detects animated PNG (acTL before IDAT)", () => {
    expect(
      isAnimatedImage(png([ihdr, ["acTL", [0, 0, 0, 2, 0, 0, 0, 0]], ["IDAT", []]]), "png"),
    ).toBe(true);
    expect(isAnimatedImage(png([ihdr, ["IDAT", []], ["IEND", []]]), "png")).toBe(false);
  });

  const webp = (chunk: string, data: number[]) => {
    const body = bytes("WEBP", chunk, data.length, 0, 0, 0, ...data);
    return bytes("RIFF", body.length & 0xff, body.length >> 8, 0, 0, ...body);
  };

  it("reads WebP VP8X dimensions and detects animation", () => {
    // flags, 3 reserved, width-1 (24-bit LE), height-1
    const still = webp("VP8X", [0x00, 0, 0, 0, 0x9f, 0x0f, 0, 0xb7, 0x0b, 0]);
    const animated = webp("VP8X", [0x02, 0, 0, 0, 0x9f, 0x0f, 0, 0xb7, 0x0b, 0]);
    expect(readPngOrWebpDimensions(still, "webp")).toEqual({ width: 4000, height: 3000 });
    expect(isAnimatedImage(still, "webp")).toBe(false);
    expect(isAnimatedImage(animated, "webp")).toBe(true);
    expect(isCompletePngOrWebp(still, "webp")).toBe(true);
    expect(isCompletePngOrWebp(still.subarray(0, still.length - 2), "webp")).toBe(false);
  });

  it("treats GIF as animated-capable", () => {
    expect(isAnimatedImage(bytes("GIF89a"), "gif")).toBe(true);
  });
});
