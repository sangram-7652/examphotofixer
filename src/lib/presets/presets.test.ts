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
      // max: null = source states only a minimum; otherwise a proper range.
      if (preset.dpi.max !== null) expect(preset.dpi.max).toBeGreaterThanOrEqual(preset.dpi.min);
      expect(preset.formats.length).toBeGreaterThan(0);
      expect(preset.source.authority).not.toBe("");
      expect(preset.source.status).not.toBe("unverified");
      expect(EXAMS[preset.exam].status).toBe("active");
    },
  );

  it("requires complete, versioned source metadata for presets marked verified", () => {
    for (const { id, source } of listPresets().filter((p) => p.source.status === "verified")) {
      expect(source.url, id).toMatch(/^https:\/\//);
      expect(source.verifiedOn, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.document, id).toBeTruthy();
      expect(source.version, id).toBeTruthy(); // values are only meaningful per version
      expect(source.published, id).toBeTruthy();
      if (source.sha256 !== undefined) expect(source.sha256, id).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("gives each source document a stable, analytics-safe id", () => {
    const byId = new Map<string, unknown>();
    for (const { id, source } of listPresets()) {
      expect(source.id, id).toMatch(/^[a-z0-9][a-z0-9.-]{2,62}$/);
      // One id per document: presets sharing an id share the same source object.
      if (byId.has(source.id)) expect(byId.get(source.id), id).toBe(source);
      byId.set(source.id, source);
    }
    expect(getPreset("ccc-photo").source.id).toBe("nielit-ccc-guidelines-v1.11");
    expect(getPreset("ibps-photo").source.id).toBe("ibps-crp-rrbs-xv-notification");
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

describe("CCC source", () => {
  it.each(["ccc-photo", "ccc-signature", "ccc-left-thumb"])(
    "%s cites NIELIT guidelines Version 1.11 (2023)",
    (id) => {
      expect(getPreset(id).source).toMatchObject({
        authority: "NIELIT",
        document: "CCC Examination Application Guidelines",
        url: "https://nva.nielit.gov.in/ccc/CCC_ExamGuideLine.pdf",
        version: "1.11",
        published: "2023",
        page: 3,
        status: "verified",
      });
    },
  );
});

describe("CCC source is shared, immutable and carries per-document guidance", () => {
  it("all CCC presets reference the same frozen source object", () => {
    const ccc = listPresets().filter((p) => p.exam === "ccc");
    expect(new Set(ccc.map((p) => p.source)).size).toBe(1);
    expect(Object.isFrozen(ccc[0].source)).toBe(true);
  });

  it("signature and thumb guidance come from the same page and differ per document", () => {
    expect(getPreset("ccc-signature").guidance?.[0]).toMatch(/^Sign on white paper/);
    expect(getPreset("ccc-left-thumb").guidance?.[0]).toMatch(
      /left thumb impression on white paper/,
    );
  });
});

describe("CCC presets match Version 1.11 (2023), page 3", () => {
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

describe("IBPS photo matches CRP RRBs XV (01.09.2026), Annexure III", () => {
  it("has the verified values, including a minimum-only DPI and preferred dimensions", () => {
    const photo = getPreset("ibps-photo");
    expect(photo).toMatchObject({
      exam: "ibps",
      documentType: "photo",
      width: 200,
      height: 230,
      preferredDimensions: true,
      fileSizeKB: { min: 20, max: 50 },
      dpi: { min: 200, max: null },
      formats: ["jpeg"],
    });
  });

  it("cites its source with URL, version, date, page, checksum and verification date", () => {
    expect(getPreset("ibps-photo").source).toMatchObject({
      authority: "IBPS",
      url: "https://www.ibps.in/wp-content/uploads/CRP-RRBs-XV-notification.pdf",
      version: "XV",
      published: "01.09.2026",
      page: 56,
      sha256: "105b0652fb7f2564adc452685248734e8546235b332b84c93f81acdb1b760508",
      verifiedOn: "2026-09-25", // re-verified unchanged (P12); first verified 2026-09-24
      status: "verified",
    });
    expect(Object.isFrozen(getPreset("ibps-photo").source)).toBe(true);
    // Photograph on printed page 56; format and scanner resolution on page 58.
    expect(getPreset("ibps-photo").sourcePages).toEqual([56, 58]);
  });

  it("does not share CCC's source", () => {
    expect(getPreset("ibps-photo").source).not.toBe(getPreset("ccc-photo").source);
  });
});

describe("IBPS signature, left thumb and declaration match CRP RRBs XV, Annexure III pp. 57–58", () => {
  it("share the photo's frozen source and cite pages 57 and 58", () => {
    for (const id of ["ibps-signature", "ibps-left-thumb", "ibps-declaration"]) {
      const preset = getPreset(id);
      expect(preset.source, id).toBe(getPreset("ibps-photo").source);
      expect(preset.sourcePages, id).toEqual([57, 58]);
      expect(preset.preferredDimensions, id).toBe(true);
      expect(preset.formats, id).toEqual(["jpeg"]);
      // "Set the scanner resolution to a minimum of 200 dpi"; no maximum stated.
      expect(preset.dpi, id).toEqual({ min: 200, max: null });
    }
  });

  it("signature: 140 x 60 pixels (preferred), 10–20 KB", () => {
    const signature = getPreset("ibps-signature");
    expect([signature.width, signature.height]).toEqual([140, 60]);
    expect(signature.fileSizeKB).toEqual({ min: 10, max: 20 });
    expect(signature.documentType).toBe("signature");
  });

  it("left thumb impression: 240 x 240 pixels in 200 DPI (preferred), 20–50 KB", () => {
    const thumb = getPreset("ibps-left-thumb");
    expect([thumb.width, thumb.height]).toEqual([240, 240]);
    expect(thumb.fileSizeKB).toEqual({ min: 20, max: 50 });
    expect(thumb.documentType).toBe("left-thumb-impression");
  });

  it("hand-written declaration: 800 x 400 pixels in 200 DPI (preferred), 50–100 KB", () => {
    const declaration = getPreset("ibps-declaration");
    expect([declaration.width, declaration.height]).toEqual([800, 400]);
    expect(declaration.fileSizeKB).toEqual({ min: 50, max: 100 });
    expect(declaration.documentType).toBe("handwritten-declaration");
  });

  it("carries guidance the engine can't check, per document", () => {
    expect(getPreset("ibps-signature").guidance?.[0]).toMatch(/black ink pen/);
    expect(getPreset("ibps-left-thumb").guidance?.[0]).toMatch(/black or blue ink/);
    expect(getPreset("ibps-declaration").guidance?.join(" ")).toMatch(/English only/);
  });
});
