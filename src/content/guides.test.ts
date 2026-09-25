import { describe, expect, it } from "vitest";
import { getPreset } from "@/lib/presets";
import { dpiText } from "@/lib/presets/describe";
import { getTool } from "@/lib/tools/registry";
import {
  GUIDE_CATEGORIES,
  buildGuide,
  getGuide,
  guidePath,
  guidesForTool,
  listGuides,
  type Guide,
} from "./guides";

const text = (guide: Guide) => JSON.stringify(buildGuide(guide));

describe("guide registry", () => {
  it("has the four CCC guides and the two IBPS guides, with unique, URL-safe slugs", () => {
    expect(listGuides().map((g) => g.slug)).toEqual([
      "ccc-photo-size",
      "ccc-signature-size",
      "ccc-thumb-impression-size",
      "ccc-photo-upload-problems",
      "ibps-photo-size",
      "ibps-signature-thumb-declaration-size",
    ]);
    for (const guide of listGuides()) {
      expect(guide.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(guidePath(guide)).toBe(`/guides/${guide.slug}`);
      expect(getGuide(guide.slug)).toBe(guide);
    }
    expect(getGuide("does-not-exist")).toBeUndefined();
  });

  it("has unique titles, meta titles and descriptions", () => {
    for (const key of ["title", "metaTitle", "description"] as const) {
      const values = listGuides().map((g) => g[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("uses only non-empty categories, and every guide links to live tools", () => {
    for (const guide of listGuides()) {
      expect(GUIDE_CATEGORIES).toContain(guide.category);
      expect(guide.toolLinks.length).toBeGreaterThan(0);
      for (const link of guide.toolLinks) {
        expect(getTool(link.toolId).status).toBe("live");
        expect(link.text.toLowerCase()).not.toMatch(/click here|read more/);
      }
    }
  });

  it("guides appear on the tools they link to", () => {
    expect(guidesForTool("ccc-photo").map((g) => g.slug)).toContain("ccc-photo-size");
    expect(guidesForTool("ccc-signature").map((g) => g.slug)).toEqual(["ccc-signature-size"]);
    expect(guidesForTool("image-compressor").map((g) => g.slug)).toEqual([
      "ccc-photo-upload-problems",
    ]);
  });
});

describe("guide content comes from presets", () => {
  it.each([
    ["ccc-photo-size", "ccc-photo"],
    ["ccc-signature-size", "ccc-signature"],
    ["ccc-thumb-impression-size", "ccc-left-thumb"],
    ["ccc-photo-upload-problems", "ccc-photo"],
    ["ibps-photo-size", "ibps-photo"],
  ])("%s states the %s preset values and its source", (slug, presetId) => {
    const guide = getGuide(slug)!;
    const preset = getPreset(presetId);
    const body = text(guide);
    expect(body).toContain(`${preset.width} × ${preset.height} pixels`);
    expect(body).toContain(`${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`);
    expect(body).toContain(dpiText(preset.dpi));
    expect(guide.presetIds).toContain(presetId);
  });

  it("follows a preset change automatically (no hard-coded numbers)", () => {
    const guide = getGuide("ccc-photo-size")!;
    const changed = {
      ...getPreset("ccc-photo"),
      width: 150,
      height: 190,
      fileSizeKB: { min: 8, max: 40 },
    };
    const body = JSON.stringify(guide.build([changed]));
    expect(body).toContain("150 × 190 pixels");
    expect(body).toContain("8–40 KB");
    expect(body).not.toMatch(/132|5–50/);
  });

  it("IBPS guide follows its preset and states the live-capture limitation", () => {
    const guide = getGuide("ibps-photo-size")!;
    const changed = {
      ...getPreset("ibps-photo"),
      width: 210,
      height: 240,
      fileSizeKB: { min: 25, max: 45 },
    };
    const body = JSON.stringify(guide.build([changed]));
    expect(body).toContain("210 × 240 pixels");
    expect(body).toContain("25–45 KB");
    expect(body).not.toMatch(/200 × 230|20–50 KB/);
    expect(text(guide)).toContain("live");
    expect(text(guide)).toContain("at least 200 DPI");
  });

  it("makes no approval, affiliation or acceptance-guarantee claims", () => {
    for (const guide of listGuides()) {
      const body = text(guide).toLowerCase();
      for (const claim of [
        "guaranteed accept",
        "100% accept",
        "nielit approved",
        "approved by nielit",
        "government approved",
        "official examphotofixer",
      ]) {
        expect(body, `${guide.slug}: ${claim}`).not.toContain(claim);
      }
    }
    // The size guides say plainly that meeting the values isn't a guarantee.
    expect(text(getGuide("ccc-photo-size")!)).toContain("doesn't guarantee");
  });
});
