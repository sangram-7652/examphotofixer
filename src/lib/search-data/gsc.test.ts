import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aggregate,
  buildReport,
  formatReport,
  highImpressionLowCtr,
  parseCsv,
  parseSearchConsoleCsv,
} from "./gsc";

// Clearly fake data (see the file header); used only to test the analysis.
const FIXTURE = readFileSync("fixtures/search-console/FAKE-search-console-sample.csv", "utf8");
const OPTIONS = { limit: 20, minImpressions: 100, maxCtr: 0.02 };

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF, BOM and comments", () => {
    expect(parseCsv('﻿# comment\r\na,"b, ""c"""\r\n\r\n1,2\n')).toEqual([
      ["a", 'b, "c"'],
      ["1", "2"],
    ]);
  });
});

describe("parseSearchConsoleCsv", () => {
  it("reads the Search Console UI export shape (Top queries, CTR as a percentage)", () => {
    const rows = parseSearchConsoleCsv(
      'Top queries,Clicks,Impressions,CTR,Position\nfake a,3,100,3%,4.5\nfake b,"1,200","2,400",50%,1',
    );
    expect(rows).toEqual([
      { query: "fake a", clicks: 3, impressions: 100, position: 4.5 },
      { query: "fake b", clicks: 1200, impressions: 2400, position: 1 },
    ]);
  });

  it("reads row-level exports with several dimensions", () => {
    const rows = parseSearchConsoleCsv(FIXTURE);
    expect(rows).toHaveLength(9);
    expect(rows[0]).toMatchObject({ query: "fake ccc photo size", device: "MOBILE", clicks: 12 });
    expect(rows[8].query).toBe('fake photo, resize "20kb"');
  });

  it("rejects files that aren't performance exports or have impossible numbers", () => {
    expect(() => parseSearchConsoleCsv("")).toThrow(/empty/);
    expect(() => parseSearchConsoleCsv("Query,Visits\nfake,1")).toThrow(/Clicks and Impressions/);
    expect(() => parseSearchConsoleCsv("Clicks,Impressions\n1,2")).toThrow(/dimension/);
    expect(() => parseSearchConsoleCsv("Query,Clicks,Impressions\nfake,5,2")).toThrow(/Row 2/);
  });
});

describe("analysis", () => {
  const rows = parseSearchConsoleCsv(FIXTURE);

  it("recomputes CTR and impression-weighted position", () => {
    const [photo] = aggregate(rows, ["query"]).filter((a) => a.key === "fake ccc photo size");
    expect(photo).toMatchObject({ clicks: 21, impressions: 600 });
    expect(photo.ctr).toBeCloseTo(0.035);
    expect(photo.position).toBeCloseTo((4 * 300 + 5 * 100 + 7.5 * 200) / 600);
  });

  it("finds high-impression, low-CTR queries by explicit thresholds", () => {
    const low = highImpressionLowCtr(aggregate(rows, ["query"]), OPTIONS).map((a) => a.key);
    expect(low).toEqual(["fake ccc signature size", 'fake photo, resize "20kb"']);
  });

  it("builds every section of the report", () => {
    const report = buildReport(rows, OPTIONS);
    expect(report.totals).toMatchObject({ clicks: 49, impressions: 1350 });
    expect(report.topQueriesByImpressions[0].key).toBe("fake ccc photo size");
    expect(report.topQueriesByClicks[1].key).toBe("fake ibps photo size");
    expect(report.topPagesByClicks[0].key).toBe("https://example.invalid/guides/ibps-photo-size");
    expect(report.queryPage[0].key).toBe(
      "fake ccc photo size | https://example.invalid/guides/ccc-photo-size",
    );
    expect(report.devices.map((a) => a.key)).toEqual(["MOBILE", "DESKTOP", "TABLET"]);
    expect(report.countries.map((a) => a.key)).toEqual(["ind", "npl"]);
    expect(report.dates.map((a) => a.key)).toEqual(["2000-01-01", "2000-01-02"]);
  });

  it("says which sections an export can't answer instead of inventing them", () => {
    const text = formatReport(
      buildReport(parseSearchConsoleCsv("Top queries,Clicks,Impressions\nfake a,1,10"), OPTIONS),
      "queries.csv",
    );
    expect(text).toContain(
      "## Top pages by clicks\n(not available: this export has no page column)",
    );
    expect(text).toContain("## Query + page combinations\n(not available");
  });
});
