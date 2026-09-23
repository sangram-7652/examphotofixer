import { describe, expect, it } from "vitest";
import { TOOLS } from "@/lib/tools/registry";
import { EXAMS, getPreset, listPresets, presetsForExam } from ".";

describe("preset registry", () => {
  it("has unique preset ids", () => {
    const ids = listPresets().map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(listPresets().map((preset) => [preset.id, preset] as const))(
    "%s is internally consistent",
    (_id, preset) => {
      expect(Number.isInteger(preset.width) && preset.width > 0).toBe(true);
      expect(Number.isInteger(preset.height) && preset.height > 0).toBe(true);
      expect(preset.fileSizeKB.min).toBeGreaterThanOrEqual(0);
      expect(preset.fileSizeKB.max).toBeGreaterThan(preset.fileSizeKB.min);
      expect(preset.dpi.min).toBeGreaterThan(0);
      expect(preset.dpi.max).toBeGreaterThanOrEqual(preset.dpi.min);
      expect(preset.formats.length).toBeGreaterThan(0);
      expect(preset.source.authority).not.toBe("");
      expect(preset.source.status).not.toBe("unverified");
      expect(EXAMS[preset.exam].status).toBe("active");
    },
  );

  it("requires url and verifiedOn for presets marked verified", () => {
    for (const preset of listPresets().filter((p) => p.source.status === "verified")) {
      expect(preset.source.url, preset.id).toMatch(/^https:\/\//);
      expect(preset.source.verifiedOn, preset.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("has no presets for planned exams (requirements are never invented)", () => {
    for (const exam of Object.values(EXAMS).filter((e) => e.status === "planned")) {
      expect(presetsForExam(exam.id)).toEqual([]);
    }
  });

  it("throws on unknown preset ids", () => {
    expect(() => getPreset("does-not-exist")).toThrow(/Unknown preset/);
  });
});

describe("CCC presets match project-supplied requirements", () => {
  it("photo", () => {
    const photo = getPreset("ccc-photo");
    expect([photo.width, photo.height]).toEqual([132, 170]);
    expect(photo.fileSizeKB).toEqual({ min: 5, max: 50 });
    expect(photo.dpi).toEqual({ min: 96, max: 300 });
    expect(photo.formats).toEqual(["jpeg"]);
  });

  it.each(["ccc-signature", "ccc-left-thumb"])("%s", (id) => {
    const preset = getPreset(id);
    expect([preset.width, preset.height]).toEqual([170, 132]);
    expect(preset.fileSizeKB).toEqual({ min: 5, max: 20 });
    expect(preset.dpi).toEqual({ min: 96, max: 200 });
    expect(preset.formats).toEqual(["jpeg"]);
  });
});

describe("tool registry", () => {
  it("references only existing presets", () => {
    for (const tool of TOOLS) {
      for (const presetId of tool.presetIds) {
        expect(() => getPreset(presetId)).not.toThrow();
      }
    }
  });

  it("has unique ids and paths", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.path)).size).toBe(TOOLS.length);
  });
});
