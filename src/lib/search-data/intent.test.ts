import { describe, expect, it } from "vitest";
import { getPreset } from "@/lib/presets";
import { classifyQuery, extractSpec, normalizeQuery } from "./intent";
import { buildSiteInventory } from "./site-inventory";

const { exams } = buildSiteInventory();
// Query text built from presets, so no requirement number is typed here.
const ccc = getPreset("ccc-photo");
const ibps = getPreset("ibps-photo");
const label = (query: string) => classifyQuery(query, exams).intent;

describe("search intent", () => {
  it.each([
    [`ccc photo resize ${ccc.width}x${ccc.height}`, "EXACT_TOOL_INTENT"],
    [`ibps photo ${ibps.fileSizeKB.min} kb`, "EXACT_TOOL_INTENT"],
    ["nielit ccc signature resizer", "EXACT_TOOL_INTENT"],
    ["ccc photo size", "REQUIREMENT_INTENT"],
    ["ibps photo dimensions", "REQUIREMENT_INTENT"],
    ["neet photo size", "REQUIREMENT_INTENT"],
    ["photo too large for upload", "PROBLEM_INTENT"],
    ["signature file size too big", "PROBLEM_INTENT"],
    ["ccc photo not uploading", "PROBLEM_INTENT"],
    ["compress jpg to 50kb", "GENERIC_TOOL_INTENT"],
    [`resize image to ${ibps.width}x${ibps.height}`, "GENERIC_TOOL_INTENT"],
    [`photo ${ibps.width}x${ibps.height}`, "GENERIC_TOOL_INTENT"],
    ["what is dpi", "INFORMATIONAL"],
    ["examphotofixer", "NAVIGATIONAL"],
    ["exam photo fixer ibps", "NAVIGATIONAL"],
  ] as const)("%s → %s", (query, intent) => {
    expect(label(query)).toBe(intent);
  });

  it("is deterministic and explains itself", () => {
    const a = classifyQuery("IBPS  Photo SIZE", exams);
    expect(a).toEqual(classifyQuery("ibps photo size", exams));
    expect(a).toMatchObject({ examId: "ibps", asset: "photo", rule: "exam+requirement" });
  });

  it("recognises exams from the registry, including planned ones and conducting bodies", () => {
    expect(classifyQuery("ssc photo size", exams).examId).toBe("ssc");
    expect(classifyQuery("nielit photo size", exams).examId).toBe("ccc");
    expect(classifyQuery("rrb signature size", exams).examId).toBe("railway");
    expect(classifyQuery("neet photo size", exams).examId).toBeNull();
  });

  it("detects the asset", () => {
    expect(classifyQuery("ccc thumb impression size", exams).asset).toBe("thumb");
    expect(classifyQuery("ibps hand written declaration size", exams).asset).toBe("declaration");
    expect(classifyQuery("ccc sign size", exams).asset).toBe("signature");
  });
});

describe("spec extraction", () => {
  it("reads dimensions and sizes, converting MB to KB", () => {
    expect(extractSpec(normalizeQuery("Photo 640 x 480 in 75KB"))).toEqual({
      dimensions: { width: 640, height: 480 },
      kb: 75,
      mentionsDpi: false,
    });
    expect(extractSpec("resize 1 mb 300 dpi").kb).toBe(1024);
    expect(extractSpec("resize 1 mb 300 dpi").mentionsDpi).toBe(true);
    expect(extractSpec("ccc photo size")).toEqual({
      dimensions: null,
      kb: null,
      mentionsDpi: false,
    });
  });
});
