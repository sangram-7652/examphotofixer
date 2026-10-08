import { describe, expect, it } from "vitest";
import { CCC_PHOTO } from "./ccc";
import { IBPS_PHOTO } from "./ibps";
import { formatIsoDate, isPdf, isVerifiedSource, sourceCitation, versionFragment } from "./source";

describe("source helpers", () => {
  it("builds the citation from source fields", () => {
    expect(sourceCitation(CCC_PHOTO.source)).toBe(
      "NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)",
    );
    expect(
      sourceCitation({ ...CCC_PHOTO.source, document: null, version: null, published: null }),
    ).toBe("NIELIT");
  });

  it("never shows 'Version X' when X is an edition/cycle already named in the document title", () => {
    // IBPS's "XV" is a recruitment cycle, not a document revision — it's part of `document`.
    expect(versionFragment(IBPS_PHOTO.source)).toBe("");
    expect(sourceCitation(IBPS_PHOTO.source)).toBe(
      "IBPS CRP RRBs-XV Detailed Notification (01.09.2026)",
    );
    expect(sourceCitation(IBPS_PHOTO.source)).not.toContain("Version");
    // A genuine document version (CCC's "1.11") is unaffected.
    expect(versionFragment(CCC_PHOTO.source)).toBe("1.11");
  });

  it("formats ISO dates without locale dependence", () => {
    expect(formatIsoDate("2026-09-24")).toBe("24 September 2026");
    expect(formatIsoDate("not-a-date")).toBe("not-a-date");
  });

  it("only treats a source as verified with status, link and date", () => {
    expect(isVerifiedSource(CCC_PHOTO.source)).toBe(true);
    expect(isVerifiedSource({ ...CCC_PHOTO.source, url: null })).toBe(false);
    expect(isVerifiedSource({ ...CCC_PHOTO.source, status: "project-input" })).toBe(false);
  });

  it("detects PDF links", () => {
    expect(isPdf(CCC_PHOTO.source.url!)).toBe(true);
    expect(isPdf("https://example.org/page")).toBe(false);
  });
});
