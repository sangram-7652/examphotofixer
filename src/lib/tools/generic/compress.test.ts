import { describe, expect, it } from "vitest";
import { byteWindowFor } from "@/lib/image/pipeline";
import { MAX_QUALITY, findQualityForByteWindow } from "@/lib/image/size-target";
import { validateAgainstPreset } from "@/lib/validation/validate";
import { KIB, MIB } from "./common";
import {
  DEFAULT_MAX_BYTES,
  SIZE_PRESETS,
  compressFilename,
  defaultCompressFormat,
  deriveCompressionOutcome,
  parseCustomKB,
  savedPercent,
  toCompressJob,
} from "./compress";

const PHOTO = { width: 4000, height: 3000, byteLength: 3 * MIB };

describe("maximum size presets (1 KB = 1024 bytes)", () => {
  it("default is 200 KB", () => expect(DEFAULT_MAX_BYTES).toBe(200 * 1024));
  it.each([
    ["100kb", 100 * 1024],
    ["200kb", 200 * 1024],
    ["500kb", 500 * 1024],
    ["1mb", 1024 * 1024],
  ])("%s = %i bytes", (id, bytes) => {
    expect(SIZE_PRESETS.find((p) => p.id === id)?.bytes).toBe(bytes);
  });

  it("custom maximum is whole KB within limits", () => {
    expect(parseCustomKB("350")).toEqual({ bytes: 350 * KIB });
    expect(parseCustomKB(" 75 ")).toEqual({ bytes: 75 * KIB });
    for (const bad of ["", "abc", "12.5", "-3", "5", "999999"]) {
      expect(parseCustomKB(bad)).toHaveProperty("error");
    }
  });
});

describe("toCompressJob", () => {
  it("preserves dimensions and caps the window at the limit and the original size", () => {
    const job = toCompressJob(PHOTO, 500 * KIB, "jpeg");
    expect(job.size).toEqual({ width: 4000, height: 3000 });
    expect(job.dimensionsReduced).toBe(false);
    expect(byteWindowFor(job.requirements)).toEqual({ minBytes: 0, maxBytes: 500 * KIB });
    expect(job.requirements.dpi).toBeNull();
    const small = toCompressJob({ ...PHOTO, byteLength: 80_000 }, 500 * KIB, "jpeg");
    expect(byteWindowFor(small.requirements)?.maxBytes).toBe(80_000);
  });

  it("reduces only images beyond the engine's browser limits", () => {
    const job = toCompressJob(
      { width: 8000, height: 6000, byteLength: 9 * MIB },
      500 * KIB,
      "jpeg",
    );
    expect(job.dimensionsReduced).toBe(true);
    expect(job.size.width * job.size.height).toBeLessThanOrEqual(16_777_216);
  });

  it("chooses WebP for transparent PNG/WebP when the browser can encode it", () => {
    const all = { jpeg: true, png: true, webp: true };
    expect(defaultCompressFormat({ format: "jpeg", mayHaveTransparency: false }, all)).toBe("jpeg");
    expect(defaultCompressFormat({ format: "png", mayHaveTransparency: true }, all)).toBe("webp");
    expect(
      defaultCompressFormat({ format: "png", mayHaveTransparency: true }, { ...all, webp: false }),
    ).toBe("jpeg");
  });
});

describe("maximum enforced on actual encoded bytes (engine search)", () => {
  // Deterministic encoder: bytes grow with quality, like a real JPEG encoder.
  const encoderFor = (bytesAt: (q: number) => number) => async (q: number) => ({
    byteLength: bytesAt(q),
  });

  it.each(SIZE_PRESETS.map((p) => [p.label, p.bytes] as const))(
    "maximum %s → output bytes ≤ limit",
    async (_label, maxBytes) => {
      const job = toCompressJob(PHOTO, maxBytes, "jpeg");
      // q30 → 90,000 bytes … q100 → 300,000 bytes.
      const result = await findQualityForByteWindow(
        encoderFor((q) => q * 3_000),
        byteWindowFor(job.requirements)!,
      );
      expect(result.status).toBe("within_range");
      expect(result.output!.byteLength).toBeLessThanOrEqual(maxBytes);
      // Highest quality that fits: one step more would exceed the limit (or q is already 100).
      if (result.quality! < MAX_QUALITY) {
        expect((result.quality! + 1) * 3_000).toBeGreaterThan(maxBytes);
      }
    },
  );

  it("500 KB: actualOutputBytes <= 500 * 1024 (1024-based, consistently)", async () => {
    const job = toCompressJob(PHOTO, 500 * KIB, "jpeg");
    // q100 → 510,000 bytes: above decimal 500,000 but within 500 × 1024 = 512,000.
    const within = await findQualityForByteWindow(
      encoderFor((q) => 400_000 + q * 1_100),
      byteWindowFor(job.requirements)!,
    );
    expect(within.quality).toBe(MAX_QUALITY);
    expect(within.output!.byteLength).toBe(510_000);
    expect(within.output!.byteLength).toBeLessThanOrEqual(500 * 1024);
    // q100 → 512,100 bytes (100 over): the search steps down to q99 → 511,000.
    const stepDown = await findQualityForByteWindow(
      encoderFor((q) => 402_100 + q * 1_100),
      byteWindowFor(job.requirements)!,
    );
    expect(stepDown.quality).toBe(99);
    expect(stepDown.output!.byteLength).toBeLessThanOrEqual(500 * 1024);
  });

  it("impossible limit → above_maximum, reported rather than presented as success", async () => {
    const job = toCompressJob(PHOTO, 100 * KIB, "jpeg");
    const result = await findQualityForByteWindow(
      encoderFor(() => 900_000),
      byteWindowFor(job.requirements)!,
    );
    expect(result.status).toBe("above_maximum");
    expect(result.output!.byteLength).toBeGreaterThan(100 * KIB);
  });
});

describe("outcome from actual bytes", () => {
  const job = toCompressJob(PHOTO, 500 * KIB, "jpeg");
  const facts = (byteLength: number) => ({
    width: 4000,
    height: 3000,
    byteLength,
    format: "jpeg" as const,
    dpi: { x: 150, y: 150 },
    metadata: [],
  });
  const outcome = (outputBytes: number, originalBytes = PHOTO.byteLength) =>
    deriveCompressionOutcome({
      originalBytes,
      maxBytes: 500 * KIB,
      outputBytes,
      validation: validateAgainstPreset(job.requirements, facts(outputBytes)),
    });

  it("SUCCESS only when ≤ limit and smaller than the original", () => {
    expect(outcome(500 * KIB)).toBe("SUCCESS"); // exactly at the limit
    expect(outcome(300_000)).toBe("SUCCESS");
  });
  it("LIMIT_NOT_REACHED one byte over", () =>
    expect(outcome(500 * KIB + 1)).toBe("LIMIT_NOT_REACHED"));
  it("LARGER_THAN_ORIGINAL when not smaller than the input", () => {
    expect(outcome(90_000, 80_000)).toBe("LARGER_THAN_ORIGINAL");
    expect(outcome(80_000, 80_000)).toBe("LARGER_THAN_ORIGINAL");
  });
  it("INVALID when another check fails (e.g. wrong dimensions)", () => {
    const bad = deriveCompressionOutcome({
      originalBytes: PHOTO.byteLength,
      maxBytes: 500 * KIB,
      outputBytes: 300_000,
      validation: validateAgainstPreset(job.requirements, { ...facts(300_000), width: 10 }),
    });
    expect(bad).toBe("INVALID");
  });

  it("saved percentage uses actual bytes", () => {
    expect(savedPercent(1_000_000, 250_000)).toBe(75);
    expect(savedPercent(80_000, 90_000)).toBe(-12.5);
  });
});

describe("filenames", () => {
  it("keeps a safe base name", () => {
    expect(compressFilename({ name: "My Photo (1).png" }, "jpeg")).toBe(
      "my-photo-1-compressed.jpg",
    );
    expect(compressFilename({ name: "..." }, "webp")).toBe("compressed-image.webp");
  });
});
