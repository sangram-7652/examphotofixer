import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_SIDE } from "@/lib/image/limits";
import {
  defaultOutputFormat,
  fitWithinEngineLimits,
  safeBaseName,
  transparencyWarning,
} from "./common";
import {
  DEFAULT_RESIZE_QUALITY,
  defaultResizeSettings,
  fitInside,
  resizeFilename,
  resizeOutputSize,
  setHeight,
  setLockAspect,
  setWidth,
  toResizeJob,
  validateResizeSettings,
} from "./resize";

const PHOTO = { width: 4000, height: 3000 };
const ALL = { jpeg: true, png: true, webp: true };

describe("defaults", () => {
  it("keeps the original proportions, capped at 1920 px, crop mode, locked", () => {
    const s = defaultResizeSettings(PHOTO, "jpeg");
    expect(s).toMatchObject({ width: 1920, height: 1440, lockAspect: true, mode: "crop" });
    expect(s.quality).toBe(DEFAULT_RESIZE_QUALITY);
    expect(defaultResizeSettings({ width: 800, height: 600 }, "png")).toMatchObject({
      width: 800,
      height: 600,
      format: "png",
    });
  });

  it("picks an output format that matches the input and the browser", () => {
    expect(
      defaultOutputFormat({ format: "jpeg", mayHaveTransparency: false }, ALL, [
        "jpeg",
        "png",
        "webp",
      ]),
    ).toBe("jpeg");
    expect(
      defaultOutputFormat({ format: "png", mayHaveTransparency: true }, ALL, [
        "jpeg",
        "png",
        "webp",
      ]),
    ).toBe("png");
    expect(
      defaultOutputFormat({ format: "webp", mayHaveTransparency: false }, ALL, [
        "jpeg",
        "png",
        "webp",
      ]),
    ).toBe("webp");
    expect(
      defaultOutputFormat({ format: "webp", mayHaveTransparency: false }, { ...ALL, webp: false }, [
        "jpeg",
        "png",
        "webp",
      ]),
    ).toBe("png");
  });
});

describe("width, height and aspect lock", () => {
  const base = defaultResizeSettings(PHOTO, "jpeg");

  it("locked: width drives height and height drives width", () => {
    expect(setWidth(base, 800)).toMatchObject({ width: 800, height: 600 });
    expect(setHeight(base, 300)).toMatchObject({ width: 400, height: 300 });
  });

  it("unlocked: sides are independent", () => {
    const unlocked = setLockAspect(base, false);
    expect(setHeight(setWidth(unlocked, 800), 800)).toMatchObject({ width: 800, height: 800 });
  });

  it("re-locking keeps the proportions the user chose", () => {
    const square = setHeight(setWidth(setLockAspect(base, false), 500), 500);
    const relocked = setLockAspect(square, true);
    expect(setWidth(relocked, 300)).toMatchObject({ width: 300, height: 300 });
  });
});

describe("crop vs fit", () => {
  it("crop outputs the exact box", () => {
    const s = { ...defaultResizeSettings(PHOTO, "jpeg"), width: 500, height: 500 };
    expect(resizeOutputSize(s, PHOTO)).toEqual({ width: 500, height: 500 });
  });

  it("fit keeps proportions inside the box, without padding", () => {
    expect(fitInside(PHOTO, { width: 500, height: 500 })).toEqual({ width: 500, height: 375 });
    expect(fitInside({ width: 3000, height: 4000 }, { width: 500, height: 500 })).toEqual({
      width: 375,
      height: 500,
    });
    const s = {
      ...defaultResizeSettings(PHOTO, "jpeg"),
      width: 500,
      height: 500,
      mode: "fit" as const,
    };
    expect(toResizeJob(s, PHOTO).size).toEqual({ width: 500, height: 375 });
  });
});

describe("engine request", () => {
  it("builds runtime requirements — no file-size or DPI requirement, one format", () => {
    const s = { ...defaultResizeSettings(PHOTO, "webp"), width: 800, height: 600, quality: 70 };
    const job = toResizeJob(s, PHOTO);
    expect(job.requirements).toEqual({
      id: "image-resizer",
      width: 800,
      height: 600,
      fileSizeKB: null,
      fileSizeBytes: null,
      dpi: null,
      formats: ["webp"],
    });
    expect(job.encoding).toEqual({ format: "webp", quality: 70 });
  });

  it("PNG carries no quality (lossless in the engine)", () => {
    const job = toResizeJob(
      { ...defaultResizeSettings(PHOTO, "png"), width: 10, height: 10 },
      PHOTO,
    );
    expect(job.encoding).toEqual({ format: "png" });
  });
});

describe("validation", () => {
  const ok = { ...defaultResizeSettings(PHOTO, "jpeg"), width: 800, height: 600 };
  it("accepts valid settings", () => expect(validateResizeSettings(ok)).toBeNull());
  it.each([
    [{ width: 0 }, "width"],
    [{ width: -5 }, "width"],
    [{ width: 12.5 }, "width"],
    [{ height: Number.NaN }, "height"],
    [{ height: MAX_OUTPUT_SIDE + 1 }, "height"],
    [{ width: 9000, height: 9000 }, "size"],
    [{ quality: 0 }, "quality"],
  ] as const)("rejects %j", (change, field) => {
    expect(validateResizeSettings({ ...ok, ...change })?.[field]).toBeTruthy();
  });
  it("ignores quality for PNG", () => {
    expect(validateResizeSettings({ ...ok, format: "png", quality: 0 })).toBeNull();
  });
});

describe("transparency", () => {
  it("warns only when JPG would drop an alpha channel", () => {
    expect(transparencyWarning("jpeg", { mayHaveTransparency: true })).toMatch(/filled with white/);
    expect(transparencyWarning("png", { mayHaveTransparency: true })).toBeNull();
    expect(transparencyWarning("jpeg", { mayHaveTransparency: false })).toBeNull();
  });
});

describe("filenames", () => {
  it("are safe and descriptive", () => {
    expect(resizeFilename({ name: "IMG_2041.HEIC.jpg" }, { width: 800, height: 600 }, "jpeg")).toBe(
      "img_2041-heic-resized-800x600.jpg",
    );
    expect(resizeFilename({ name: "<script>.png" }, { width: 5, height: 5 }, "png")).toBe(
      "script-resized-5x5.png",
    );
    expect(resizeFilename({ name: "फोटो.jpg" }, { width: 800, height: 600 }, "webp")).toBe(
      "resized-800x600.webp",
    );
    expect(safeBaseName("../../etc/passwd")).toBe("passwd");
  });
});

describe("engine limits", () => {
  it("reduces sizes beyond the browser budget, keeping proportions", () => {
    expect(fitWithinEngineLimits({ width: 4000, height: 3000 })).toEqual({
      size: { width: 4000, height: 3000 },
      reduced: false,
    });
    const { size, reduced } = fitWithinEngineLimits({ width: 8000, height: 6000 });
    expect(reduced).toBe(true);
    expect(size.width * size.height).toBeLessThanOrEqual(16_777_216);
    expect(size.width / size.height).toBeCloseTo(4 / 3, 2);
  });
});
