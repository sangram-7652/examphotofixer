import { describe, expect, it } from "vitest";
import {
  detectImageFormat,
  isAnimatedImage,
  isCompletePngOrWebp,
  listPngOrWebpMetadata,
  mayHaveTransparency,
  readPngOrWebpDimensions,
  stripPngOrWebpMetadata,
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

describe("transparency and PNG/WebP metadata", () => {
  const chunk = (type: string, data: number[]) => [
    0,
    0,
    (data.length >> 8) & 0xff,
    data.length & 0xff,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0,
  ];
  const png = (colorType: number, extra: number[][] = []) =>
    bytes(
      0x89,
      "PNG",
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...chunk("IHDR", [0, 0, 0, 10, 0, 0, 0, 10, 8, colorType, 0, 0, 0]),
      ...extra.flat(),
      ...chunk("IDAT", [1]),
      ...chunk("IEND", []),
    );

  it("detects alpha from PNG colour type or tRNS", () => {
    expect(mayHaveTransparency(png(6), "png")).toBe(true);
    expect(mayHaveTransparency(png(2), "png")).toBe(false);
    expect(mayHaveTransparency(png(2, [chunk("tRNS", [0, 0])]), "png")).toBe(true);
    expect(mayHaveTransparency(bytes(0xff, 0xd8, 0xff), "jpeg")).toBe(false);
  });

  it("lists PNG metadata chunks", () => {
    const withMeta = png(6, [
      chunk("eXIf", [1, 2]),
      chunk("tEXt", [...[..."Author"].map((c) => c.charCodeAt(0)), 0, 65]),
      chunk("iCCP", [1]),
    ]);
    expect(listPngOrWebpMetadata(withMeta, "png")).toEqual(["comment", "exif", "icc"]);
    expect(listPngOrWebpMetadata(png(6), "png")).toEqual([]);
  });
});

describe("stripPngOrWebpMetadata", () => {
  const riff = (chunks: [string, number[]][]) => {
    const body = chunks.flatMap(([id, data]) => [
      ...[...id].map((c) => c.charCodeAt(0)),
      data.length & 0xff,
      (data.length >> 8) & 0xff,
      0,
      0,
      ...data,
      ...(data.length % 2 ? [0] : []),
    ]);
    const size = body.length + 4;
    return bytes("RIFF", size & 0xff, size >> 8, 0, 0, "WEBP", ...body);
  };
  // VP8X: flags ICC|alpha, then 400×300 canvas; an ICCP profile and a VP8 frame.
  const vp8x = [0x30, 0, 0, 0, 0x8f, 0x01, 0, 0x2b, 0x01, 0];
  const webp = riff([
    ["VP8X", vp8x],
    ["ICCP", [1, 2, 3, 4, 5]],
    ["EXIF", [9, 9]],
    ["VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x90, 0x01, 0x2c, 0x01]],
  ]);

  it("removes ICC/EXIF from WebP, clears flags, fixes the RIFF size, keeps image data", () => {
    expect(listPngOrWebpMetadata(webp, "webp")).toEqual(["exif", "icc"]);
    const clean = stripPngOrWebpMetadata(webp, "webp");
    expect(listPngOrWebpMetadata(clean, "webp")).toEqual([]);
    expect(clean[20] & 0x20).toBe(0); // ICC flag cleared
    expect(clean[20] & 0x10).toBe(0x10); // alpha flag kept
    const riffSize = clean[4] | (clean[5] << 8) | (clean[6] << 16) | (clean[7] << 24);
    expect(riffSize + 8).toBe(clean.length);
    expect(readPngOrWebpDimensions(clean, "webp")).toEqual({ width: 400, height: 300 });
    expect(isCompletePngOrWebp(clean, "webp")).toBe(true);
  });

  it("removes PNG text/EXIF/ICC chunks and keeps the rest", () => {
    const chunk = (type: string, data: number[]) => [
      0,
      0,
      0,
      data.length,
      ...[...type].map((c) => c.charCodeAt(0)),
      ...data,
      1,
      2,
      3,
      4,
    ];
    const png = bytes(
      0x89,
      "PNG",
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...chunk("IHDR", [0, 0, 0, 10, 0, 0, 0, 10, 8, 6, 0, 0, 0]),
      ...chunk("iCCP", [1]),
      ...chunk("tEXt", [65, 0, 66]),
      ...chunk("IDAT", [7, 7]),
      ...chunk("IEND", []),
    );
    const clean = stripPngOrWebpMetadata(png, "png");
    expect(listPngOrWebpMetadata(clean, "png")).toEqual([]);
    expect(isCompletePngOrWebp(clean, "png")).toBe(true);
    expect(clean.length).toBe(png.length - (12 + 1) - (12 + 3));
  });
});
