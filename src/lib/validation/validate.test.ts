import { describe, expect, it } from "vitest";
import type { OutputFacts } from "@/lib/image/pipeline";
import { MAX_INPUT_BYTES } from "@/lib/image/limits";
import { getPreset } from "@/lib/presets";
import { checkInputFile, validateAgainstPreset } from "./validate";

const photo = getPreset("ccc-photo");
const signature = getPreset("ccc-signature");

const validPhoto: OutputFacts = {
  width: 132,
  height: 170,
  byteLength: 20_000,
  format: "jpeg",
  dpi: { x: 150, y: 150 },
  metadata: [],
};

function statusOf(facts: OutputFacts, id: string, preset = photo) {
  return validateAgainstPreset(preset, facts).checks.find((check) => check.id === id)?.status;
}

describe("validateAgainstPreset", () => {
  it("marks a compliant file as ready", () => {
    const report = validateAgainstPreset(photo, validPhoto);
    expect(report.ready).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual([
      "dimensions",
      "aspect-ratio",
      "format",
      "file-size",
      "dpi",
      "metadata",
    ]);
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("fails wrong dimensions with an actionable message", () => {
    const report = validateAgainstPreset(photo, { ...validPhoto, width: 170, height: 132 });
    const dimensions = report.checks.find((check) => check.id === "dimensions");
    expect(report.ready).toBe(false);
    expect(dimensions?.status).toBe("fail");
    expect(dimensions?.message).toContain("132 × 170");
    expect(statusOf({ ...validPhoto, width: 170, height: 132 }, "aspect-ratio")).toBe("fail");
  });

  it("fails non-JPEG output", () => {
    expect(statusOf({ ...validPhoto, format: "png" }, "format")).toBe("fail");
    expect(statusOf({ ...validPhoto, format: null }, "format")).toBe("fail");
  });

  it("checks file-size boundaries conservatively", () => {
    expect(statusOf({ ...validPhoto, byteLength: 5 * 1024 }, "file-size")).toBe("pass");
    expect(statusOf({ ...validPhoto, byteLength: 5 * 1024 - 1 }, "file-size")).toBe("fail");
    expect(statusOf({ ...validPhoto, byteLength: 50_000 }, "file-size")).toBe("pass");
    expect(statusOf({ ...validPhoto, byteLength: 50_001 }, "file-size")).toBe("fail");
    const sigFacts = { ...validPhoto, width: 170, height: 132 };
    expect(statusOf({ ...sigFacts, byteLength: 20_001 }, "file-size", signature)).toBe("fail");
  });

  it("checks DPI range and missing DPI", () => {
    expect(statusOf({ ...validPhoto, dpi: { x: 96, y: 96 } }, "dpi")).toBe("pass");
    expect(statusOf({ ...validPhoto, dpi: { x: 300, y: 300 } }, "dpi")).toBe("pass");
    expect(statusOf({ ...validPhoto, dpi: { x: 72, y: 72 } }, "dpi")).toBe("fail");
    expect(statusOf({ ...validPhoto, dpi: { x: 150, y: 301 } }, "dpi")).toBe("fail");
    expect(statusOf({ ...validPhoto, dpi: null }, "dpi")).toBe("fail");
    const sigFacts = { ...validPhoto, width: 170, height: 132, dpi: { x: 300, y: 300 } };
    expect(statusOf(sigFacts, "dpi", signature)).toBe("fail");
  });

  it("fails when personal metadata is present", () => {
    const report = validateAgainstPreset(photo, { ...validPhoto, metadata: ["exif", "gps"] });
    const metadata = report.checks.find((check) => check.id === "metadata");
    expect(report.ready).toBe(false);
    expect(metadata?.status).toBe("fail");
    expect(metadata?.actual).toBe("EXIF, GPS location");
  });

  it("minimum-only DPI (IBPS): at least the minimum passes, no upper bound", () => {
    const ibps = getPreset("ibps-photo");
    const facts = { ...validPhoto, width: 200, height: 230, byteLength: 30_000 };
    const dpiOf = (x: number) =>
      validateAgainstPreset(ibps, { ...facts, dpi: { x, y: x } }).checks.find(
        (c) => c.id === "dpi",
      )!;
    expect(dpiOf(200).status).toBe("pass");
    expect(dpiOf(600).status).toBe("pass");
    expect(dpiOf(150)).toMatchObject({ status: "fail", expected: "at least 200 DPI" });
    expect(dpiOf(150).message).toBe("DPI must be at least 200.");
  });

  it("reports processing errors and skips the rest", () => {
    const report = validateAgainstPreset(photo, null, "Could not read this image.");
    expect(report.ready).toBe(false);
    expect(report.checks[0]).toMatchObject({
      id: "processing",
      status: "fail",
      message: "Could not read this image.",
    });
    expect(report.checks.slice(1).every((check) => check.status === "skipped")).toBe(true);
  });
});

describe("checkInputFile", () => {
  it("accepts supported formats", () => {
    expect(checkInputFile({ byteLength: 1000, format: "jpeg" })).toBeNull();
    expect(checkInputFile({ byteLength: 1000, format: "png" })).toBeNull();
  });

  it("rejects empty, oversized and unsupported files", () => {
    expect(checkInputFile({ byteLength: 0, format: "jpeg" })).toBe("empty-file");
    expect(checkInputFile({ byteLength: MAX_INPUT_BYTES + 1, format: "jpeg" })).toBe(
      "file-too-large",
    );
    expect(checkInputFile({ byteLength: 1000, format: null })).toBe("unsupported-format");
    expect(checkInputFile({ byteLength: 1000, format: "heic" })).toBe("unsupported-format");
  });
});
