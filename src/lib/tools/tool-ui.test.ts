import { describe, expect, it } from "vitest";
import { getToolContent } from "@/content/tool-content";
import type { OutputFacts } from "@/lib/image/pipeline";
import { getPreset } from "@/lib/presets";
import { CCC_LEFT_THUMB, CCC_PHOTO, CCC_SIGNATURE } from "@/lib/presets/ccc";
import type { ValidationCheck } from "@/lib/validation/types";
import { validateAgainstPreset } from "@/lib/validation/validate";
import { ERROR_COPY, errorMessageFor, isRetryable } from "./error-copy";
import { buildDownloadFilename, documentNoun } from "./preset-labels";
import { PROGRESS_STEPS, stepForStage, stepIndex } from "./progress-steps";
import { TOOLS, getTool } from "./registry";
import { buildChecklist, deriveResultState } from "./result-state";

describe("buildDownloadFilename", () => {
  it("derives names from presets", () => {
    expect(buildDownloadFilename(CCC_PHOTO)).toBe("CCC_Photo_132x170.jpg");
    expect(buildDownloadFilename(CCC_SIGNATURE)).toBe("CCC_Signature_170x132.jpg");
    expect(buildDownloadFilename(CCC_LEFT_THUMB)).toBe("CCC_Left_Thumb_170x132.jpg");
  });

  it("follows preset values rather than fixed strings", () => {
    expect(buildDownloadFilename({ ...CCC_PHOTO, width: 200, height: 230 })).toBe(
      "CCC_Photo_200x230.jpg",
    );
    expect(documentNoun(CCC_LEFT_THUMB)).toBe("thumb impression");
  });
});

const goodFacts: OutputFacts = {
  width: 132,
  height: 170,
  byteLength: 20_000,
  format: "jpeg",
  dpi: { x: 150, y: 150 },
  metadata: [],
};

function resultFor(facts: OutputFacts, status: "within_range" | "below_minimum" | "above_maximum") {
  return {
    validation: validateAgainstPreset(CCC_PHOTO, facts),
    compression: { status, quality: 90, attempts: 1, message: null },
  };
}

describe("deriveResultState / buildChecklist", () => {
  it("READY when every engine check passes", () => {
    const result = resultFor(goodFacts, "within_range");
    expect(deriveResultState(result)).toBe("READY");
    expect(buildChecklist(result).map((item) => [item.id, item.status])).toEqual([
      ["dimensions", "pass"],
      ["file-size", "pass"],
      ["format", "pass"],
      ["dpi", "pass"],
      ["metadata", "pass"],
    ]);
  });

  it("READY_WITH_WARNING for below_minimum when everything else passes", () => {
    const result = resultFor({ ...goodFacts, byteLength: 4300 }, "below_minimum");
    expect(deriveResultState(result)).toBe("READY_WITH_WARNING");
    const size = buildChecklist(result).find((item) => item.id === "file-size");
    expect(size).toMatchObject({ status: "warning", value: "4.2 KB" });
  });

  it("INVALID when a small file comes with another failure", () => {
    const result = resultFor({ ...goodFacts, byteLength: 4300, dpi: null }, "below_minimum");
    expect(deriveResultState(result)).toBe("INVALID");
  });

  it("INVALID for above_maximum (size is a hard failure there)", () => {
    const result = resultFor({ ...goodFacts, byteLength: 90_000 }, "above_maximum");
    expect(deriveResultState(result)).toBe("INVALID");
    expect(buildChecklist(result).find((item) => item.id === "file-size")?.status).toBe("fail");
  });

  it("INVALID when a check not shown in the checklist fails", () => {
    const checks: ValidationCheck[] = resultFor(goodFacts, "within_range").validation.checks.map(
      (check) => (check.id === "aspect-ratio" ? { ...check, status: "fail" } : check),
    );
    const result = {
      validation: { presetId: "x", ready: false, checks },
      compression: { status: "within_range" as const, quality: 90, attempts: 1, message: null },
    };
    expect(deriveResultState(result)).toBe("INVALID");
  });
});

describe("progress steps", () => {
  it("maps every engine stage to a step, in order", () => {
    const stages = [
      "loading",
      "orientation",
      "cropping",
      "resizing",
      "encoding",
      "dpi",
      "metadata",
      "validation",
      "complete",
    ] as const;
    const indices = stages.map(stepIndex);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(stepForStage("loading")).toBe("Preparing image");
    expect(stepForStage("encoding")).toBe("Compressing");
    expect(stepForStage("complete")).toBe(PROGRESS_STEPS.at(-1));
    expect(stepIndex(null)).toBe(-1);
  });
});

describe("error copy", () => {
  it("uses friendly wording without internals", () => {
    expect(errorMessageFor("unsupported-format")).toBe(ERROR_COPY.unsupported);
    expect(errorMessageFor("animated-image")).toBe(ERROR_COPY.unsupported);
    expect(errorMessageFor("corrupt-file")).toBe(ERROR_COPY.unreadable);
    expect(errorMessageFor("decode-failed")).toBe(ERROR_COPY.unreadable);
    expect(errorMessageFor("unsupported-browser")).toBe(ERROR_COPY.browser);
    expect(errorMessageFor("internal-error")).toBe(ERROR_COPY.processing);
    expect(isRetryable("worker-failed")).toBe(true);
    expect(isRetryable("corrupt-file")).toBe(false);
  });
});

describe("tool registry and content", () => {
  it("live single tools have one preset; live packs combine presets of one exam", () => {
    for (const tool of TOOLS.filter((t) => t.status === "live")) {
      if (tool.kind === "pack") {
        expect(tool.presetIds.length, tool.id).toBeGreaterThan(1);
        expect(new Set(tool.presetIds.map((id) => getPreset(id).exam)).size).toBe(1);
      } else {
        expect(tool.presetIds, tool.id).toHaveLength(1);
      }
    }
    expect(
      ["ccc-photo", "ccc-signature", "ccc-thumb", "ccc-pack"]
        .map((id) => getTool(id as Parameters<typeof getTool>[0]))
        .every((tool) => tool.status === "live"),
    ).toBe(true);
    expect(getTool("ccc-pack").path).toBe("/ccc-complete-pack");
  });

  it.each([
    ["ccc-signature", CCC_SIGNATURE],
    ["ccc-thumb", CCC_LEFT_THUMB],
  ] as const)("%s content is built from its preset and cites the source", (id, preset) => {
    const tool = getTool(id);
    const changed = { ...preset, width: 181, height: 141, fileSizeKB: { min: 7, max: 23 } };
    const text = JSON.stringify(getToolContent(tool, [changed]));
    expect(text).toContain("181 × 141");
    expect(text).toContain("7–23 KB");
    expect(text).not.toMatch(/170 × 132|5–20 KB/);
    expect(text).toContain("Version 1.11 (2023)");
    for (const line of preset.guidance ?? []) expect(text).toContain(line);
  });

  it("pack content lists every preset's values", () => {
    const text = JSON.stringify(
      getToolContent(getTool("ccc-pack"), [CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB]),
    );
    for (const preset of [CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB]) {
      expect(text).toContain(`${preset.width} × ${preset.height} pixels`);
      expect(text).toContain(`${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`);
    }
  });

  it("content numbers come from the preset", () => {
    const tool = getTool("ccc-photo");
    const changed = { ...CCC_PHOTO, width: 140, height: 180, fileSizeKB: { min: 8, max: 40 } };
    const text = JSON.stringify(getToolContent(tool, [changed]));
    expect(text).toContain("140 × 180");
    expect(text).toContain("8–40 KB");
    expect(text).not.toContain("132");
    expect(text).not.toContain("5–50");
  });

  it("FAQ cites the versioned source and repeats the preset's guidance", () => {
    const content = getToolContent(getTool("ccc-photo"), [CCC_PHOTO])!;
    const text = JSON.stringify(content);
    expect(text).toContain("NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)");
    for (const line of CCC_PHOTO.guidance ?? []) expect(text).toContain(line);
    expect(text.toLowerCase()).not.toContain("phone camera");
  });
});
