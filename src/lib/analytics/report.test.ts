import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  engagementByRoute,
  funnelByTool,
  funnelCounts,
  gatedFunnel,
  parseEventExport,
  reasonCounts,
} from "./report";

// Clearly fake data (see the file header); used only to test the analysis.
const events = parseEventExport(
  readFileSync("fixtures/analytics/FAKE-events-sample.ndjson", "utf8"),
);

describe("event export", () => {
  it("parses NDJSON, skipping comments and blank lines", () => {
    expect(events).toHaveLength(21);
    expect(parseEventExport('# c\n\n{"name":"page_view","props":{}}\n')).toEqual([
      { name: "page_view", props: {} },
    ]);
  });

  it("rejects malformed lines with their line number", () => {
    expect(() => parseEventExport("{not json")).toThrow(/Line 1/);
    expect(() => parseEventExport('{"name":1,"props":{}}')).toThrow(/Line 1/);
  });

  it("contains only allowlisted, non-identifying data", () => {
    const text = JSON.stringify(events);
    expect(text).not.toMatch(/blob:|data:|https?:|@|\.jpg|filename/i);
  });
});

describe("funnel", () => {
  const counts = funnelCounts(events);

  it("counts accepted selections only and keeps READY and warning apart", () => {
    expect(counts).toMatchObject({
      tool_viewed: 2,
      image_selected: 3, // the rejected file is not a selection
      processing_started: 3,
      processing_completed: 3,
      result_ready: 1,
      result_ready_with_warning: 1,
      validation_failed: 1,
      download_completed_ready: 1,
      download_completed_warning: 0,
    });
  });

  it("withholds every rate below the minimum sample", () => {
    const gated = gatedFunnel(counts, 100);
    for (const rate of Object.values(gated)) {
      expect(rate.sufficient).toBe(false);
      expect(rate.rate).toBeNull();
    }
    const small = gatedFunnel(counts, 3);
    expect(small.ready_rate).toEqual({ rate: 1 / 3, denominator: 3, sufficient: true });
    expect(small.successful_download_rate).toMatchObject({ rate: null, denominator: 1 });
  });

  it("splits by tool", () => {
    const byTool = funnelByTool(events);
    expect(byTool.get("ccc-photo")).toMatchObject({
      result_ready: 1,
      result_ready_with_warning: 1,
    });
    expect(byTool.get("image-compressor")).toMatchObject({ validation_failed: 1 });
  });
});

describe("problem discovery", () => {
  it("tallies reason and error codes per outcome", () => {
    const reasons = reasonCounts(events);
    expect(reasons.validation_failed).toEqual([
      { key: "COMPRESSION_LIMIT_NOT_REACHED", count: 1, share: 1 },
    ]);
    expect(reasons.result_ready_with_warning[0].key).toBe("FILE_TOO_SMALL");
    expect(reasons.image_rejected[0].key).toBe("unsupported-format");
    expect(reasons.processing_failed).toEqual([]);
  });
});

describe("engagement by route", () => {
  it("measures tool pages per tool view and guides per page view, gated by sample", () => {
    const routes = engagementByRoute(events, 1);
    expect(routes.find((r) => r.route === "/guides/ccc-photo-size")).toMatchObject({
      pageViews: 1,
      organicLandings: 1,
      engaged: 1,
      engagementRate: { rate: 1, denominator: 1, sufficient: true },
    });
    expect(routes.find((r) => r.route === "/ccc-photo-resizer")?.engagementRate.denominator).toBe(
      1,
    );
    expect(engagementByRoute(events, 100).every((r) => r.engagementRate.rate === null)).toBe(true);
  });
});
