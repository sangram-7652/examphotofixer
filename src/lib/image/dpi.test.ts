import { describe, expect, it } from "vitest";
import { getPreset } from "@/lib/presets";
import { PREFERRED_OUTPUT_DPI, chooseOutputDpi } from "./dpi";

describe("chooseOutputDpi", () => {
  it.each(["ccc-photo", "ccc-signature", "ccc-left-thumb"])(
    "picks a DPI strictly inside the %s range",
    (id) => {
      const { dpi } = getPreset(id);
      const chosen = chooseOutputDpi(dpi);
      expect(chosen).toBeGreaterThan(dpi.min);
      expect(chosen).toBeLessThan(dpi.max);
    },
  );

  it("clamps into ranges that exclude the preferred value", () => {
    expect(chooseOutputDpi({ min: 300, max: 600 })).toBe(300);
    expect(chooseOutputDpi({ min: 72, max: 96 })).toBe(96);
    expect(chooseOutputDpi({ min: 72, max: 600 })).toBe(PREFERRED_OUTPUT_DPI);
  });

  it("rejects invalid ranges", () => {
    expect(() => chooseOutputDpi({ min: 0, max: 100 })).toThrow(RangeError);
    expect(() => chooseOutputDpi({ min: 200, max: 100 })).toThrow(RangeError);
  });
});
