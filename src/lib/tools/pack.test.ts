import { describe, expect, it } from "vitest";
import { CCC_LEFT_THUMB, CCC_PHOTO, CCC_SIGNATURE } from "@/lib/presets/ccc";
import { assetStateFor, derivePackState, isDownloadable, type AssetState } from "./pack-state";
import { buildDownloadFilename, buildPackFilename, documentTitle } from "./preset-labels";

describe("assetStateFor", () => {
  it("maps ImageTool states to asset states", () => {
    expect(assetStateFor("SELECT", false)).toBe("EMPTY");
    expect(assetStateFor("SELECT", true)).toBe("ERROR");
    expect(assetStateFor("CROP", false)).toBe("SELECTED");
    expect(assetStateFor("PROCESSING", false)).toBe("PROCESSING");
    expect(assetStateFor("READY_WITH_WARNING", false)).toBe("READY_WITH_WARNING");
    expect(assetStateFor("INVALID", false)).toBe("INVALID");
    expect(assetStateFor("UNSUPPORTED", false)).toBe("ERROR");
  });
});

describe("derivePackState", () => {
  const cases: [AssetState[], string][] = [
    [["EMPTY", "EMPTY", "EMPTY"], "EMPTY"],
    [["SELECTED", "EMPTY", "EMPTY"], "IN_PROGRESS"],
    [["READY", "READY", "EMPTY"], "IN_PROGRESS"], // not ready until all three are done
    [["READY", "READY", "PROCESSING"], "IN_PROGRESS"],
    [["READY", "READY", "READY"], "READY"],
    [["READY", "READY_WITH_WARNING", "READY"], "READY_WITH_WARNING"],
    [["READY", "READY", "INVALID"], "INCOMPLETE"],
    [["READY", "ERROR", "EMPTY"], "INCOMPLETE"],
    [["READY_WITH_WARNING", "INVALID", "READY"], "INCOMPLETE"],
  ];
  it.each(cases)("%j → %s", (assets, expected) => {
    expect(derivePackState(assets)).toBe(expected);
  });

  it("only READY and READY_WITH_WARNING are downloadable", () => {
    expect(isDownloadable("READY")).toBe(true);
    expect(isDownloadable("READY_WITH_WARNING")).toBe(true);
    expect(isDownloadable("INVALID")).toBe(false);
  });

  it("is EMPTY → IN_PROGRESS → READY through a full run, and back to EMPTY on reset", () => {
    const run: AssetState[][] = [
      ["EMPTY", "EMPTY", "EMPTY"],
      ["SELECTED", "EMPTY", "EMPTY"],
      ["PROCESSING", "EMPTY", "EMPTY"],
      ["READY", "SELECTED", "EMPTY"],
      ["READY", "READY", "PROCESSING"],
      ["READY", "READY", "READY"],
      ["EMPTY", "EMPTY", "EMPTY"],
    ];
    expect(run.map(derivePackState)).toEqual([
      "EMPTY",
      "IN_PROGRESS",
      "IN_PROGRESS",
      "IN_PROGRESS",
      "IN_PROGRESS",
      "READY",
      "EMPTY",
    ]);
  });
});

describe("pack labels", () => {
  it("names files from presets", () => {
    expect([CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB].map(buildDownloadFilename)).toEqual([
      "CCC_Photo_132x170.jpg",
      "CCC_Signature_170x132.jpg",
      "CCC_Left_Thumb_170x132.jpg",
    ]);
    expect(buildPackFilename("ccc")).toBe("CCC_Complete_Pack.zip");
    expect([CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB].map(documentTitle)).toEqual([
      "Photo",
      "Signature",
      "Left thumb impression",
    ]);
  });
});
