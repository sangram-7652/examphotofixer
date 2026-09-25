import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPreset } from "@/lib/presets";
import type { SearchRow } from "./gsc";
import { parseSearchConsoleCsv } from "./gsc";
import { buildOpportunities, dataClassOf, newQueries } from "./opportunities";
import { buildSiteInventory, findPage } from "./site-inventory";

const inventory = buildSiteInventory();
const ORIGIN = "https://example.invalid";
const EVIDENCE = { source: "test", dataClass: "TEST_FIXTURE" as const };

function row(
  query: string,
  page: string,
  clicks: number,
  impressions: number,
  position = 5,
): SearchRow {
  return { query, page: `${ORIGIN}${page}`, clicks, impressions, position };
}
const only = (rows: SearchRow[]) => buildOpportunities(rows, inventory, EVIDENCE)[0];

describe("site inventory", () => {
  it("is derived from the registries", () => {
    expect(inventory.exams.find((e) => e.id === "ccc")?.terms).toContain("nielit");
    expect(findPage(inventory, `${ORIGIN}/guides/ibps-photo-size/`)).toMatchObject({
      kind: "guide",
      examId: "ibps",
    });
    expect(findPage(inventory, `${ORIGIN}/ccc-photo-resizer`)).toMatchObject({
      kind: "tool",
      toolId: "ccc-photo",
      examId: "ccc",
    });
    const photo = getPreset("ccc-photo");
    expect(inventory.requirements).toContainEqual(
      expect.objectContaining({ presetId: "ccc-photo", width: photo.width, height: photo.height }),
    );
    expect(inventory.examsWithProblemGuide).toContain("ccc");
  });
});

describe("opportunities", () => {
  it("never acts below the evidence threshold or on brand queries", () => {
    expect(only([row("ccc photo size", "/guides/ccc-photo-size", 0, 99, 2)]).type).toBe(
      "NO_ACTION",
    );
    expect(only([row("examphotofixer", "/", 0, 5000, 1)]).type).toBe("NO_ACTION");
  });

  it("proposes title/description review for low CTR at a good position", () => {
    const o = only([row("ccc photo size", "/guides/ccc-photo-size", 2, 400, 4)]);
    expect(o).toMatchObject({
      type: "OPTIMIZE_EXISTING_PAGE",
      intent: "REQUIREMENT_INTENT",
      existingGuide: "ccc-photo-size",
      verificationRequired: false,
    });
  });

  it("leaves pages alone when CTR is reasonable or the page doesn't rank yet", () => {
    expect(only([row("ccc photo size", "/guides/ccc-photo-size", 40, 400, 4)]).type).toBe(
      "NO_ACTION",
    );
    expect(only([row("ccc photo size", "/guides/ccc-photo-size", 1, 400, 25)]).type).toBe(
      "NO_ACTION",
    );
  });

  it("planned or unknown exams: CREATE_TOOL only behind official verification", () => {
    expect(only([row("ssc photo size", "/", 0, 500, 30)])).toMatchObject({
      type: "CREATE_TOOL",
      verificationRequired: true,
    });
    expect(only([row("neet photo size", "/", 0, 500, 30)])).toMatchObject({
      type: "CREATE_TOOL",
      verificationRequired: true,
    });
  });

  it("an active exam asset without a verified preset needs verification first", () => {
    // CCC's guidelines have no declaration; demand alone never creates one.
    expect(only([row("ccc declaration size", "/guides/ccc-photo-size", 1, 300, 12)])).toMatchObject(
      {
        type: "CREATE_TOOL",
        examId: "ccc",
        verificationRequired: true,
      },
    );
  });

  it("search numbers that differ from the verified preset trigger a source re-check, not a change", () => {
    const photo = getPreset("ibps-photo");
    const differing = `ibps photo ${photo.width + 50}x${photo.height} resize`;
    const o = only([row(differing, "/ibps-photo-resizer", 1, 300, 3)]);
    expect(o).toMatchObject({ type: "REVERIFY_SOURCE", verificationRequired: true });
    expect(o.reason).toMatch(/re-check the official source/);
    expect(o.reason).toMatch(/do not change the preset/);

    const matching = `ibps photo ${photo.width}x${photo.height} resize`;
    expect(only([row(matching, "/ibps-photo-resizer", 30, 300, 3)]).type).toBe("NO_ACTION");
    const tooBig = `ibps photo ${photo.fileSizeKB.max + 50} kb`;
    expect(only([row(tooBig, "/ibps-photo-resizer", 30, 300, 3)]).type).toBe("REVERIFY_SOURCE");
  });

  it("problem demand for an exam without a problems guide → CREATE_GUIDE", () => {
    expect(only([row("ibps photo upload error", "/ibps-photo-resizer", 1, 300, 8)]).type).toBe(
      "CREATE_GUIDE",
    );
    // CCC already has an upload-problems guide.
    expect(
      only([row("ccc photo upload error", "/guides/ccc-photo-upload-problems", 1, 300, 30)]).type,
    ).toBe("NO_ACTION");
  });

  it("tool-intent queries landing on a guide → ADD_INTERNAL_LINK", () => {
    const photo = getPreset("ccc-photo");
    const query = `ccc photo resize ${photo.width}x${photo.height}`;
    expect(only([row(query, "/guides/ccc-photo-size", 20, 300, 3)]).type).toBe("ADD_INTERNAL_LINK");
  });

  it("aggregates a query across pages and reports its top page and evidence", () => {
    const [o] = buildOpportunities(
      [
        row("ccc photo size", "/guides/ccc-photo-size", 1, 300, 4),
        row("ccc photo size", "/ccc-photo-resizer", 1, 100, 6),
      ],
      inventory,
      { source: "export.csv", dataClass: "REAL" },
    );
    expect(o).toMatchObject({
      impressions: 400,
      clicks: 2,
      page: `${ORIGIN}/guides/ccc-photo-size`,
      evidence: { source: "export.csv", dataClass: "REAL" },
    });
    expect(o.position).toBeCloseTo((4 * 300 + 6 * 100) / 400);
  });
});

describe("data class and new queries", () => {
  it("marks the committed fixture as test data and anything else as a real export", () => {
    const fixture = readFileSync("fixtures/search-console/FAKE-search-console-sample.csv", "utf8");
    expect(dataClassOf(fixture)).toBe("TEST_FIXTURE");
    expect(dataClassOf("Query,Clicks,Impressions\nx,1,2")).toBe("REAL");
    // The whole fixture stays below the evidence threshold: no proposals from fake data.
    const proposals = buildOpportunities(parseSearchConsoleCsv(fixture), inventory, EVIDENCE);
    expect(proposals.filter((o) => o.type !== "NO_ACTION")).toEqual([]);
  });

  it("lists queries that are new since the previous export", () => {
    const previous = [row("ccc photo size", "/", 1, 10)];
    const current = [row("ccc photo size", "/", 2, 20), row("ibps photo size", "/", 1, 30)];
    expect(newQueries(current, previous).map((q) => q.key)).toEqual(["ibps photo size"]);
  });
});
