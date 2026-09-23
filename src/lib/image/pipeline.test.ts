import { describe, expect, it } from "vitest";
import { CCC_PHOTO } from "@/lib/presets/ccc";
import { PROCESSING_ERROR_MESSAGES, PROGRESS_STAGES, type OutputRequirements } from "./pipeline";
import { progressFor } from "./worker/protocol";

/**
 * Pipeline behaviour on real images (decode, orientation, crop, resize,
 * transparency, encoding, compression, DPI, metadata, large images, worker
 * errors, progress, validation) is covered in a real browser by
 * e2e/image-engine.spec.ts. These are the contract tests.
 */
describe("pipeline contract", () => {
  it("reports progress stages in pipeline order", () => {
    expect(PROGRESS_STAGES).toEqual([
      "loading",
      "orientation",
      "cropping",
      "resizing",
      "encoding",
      "dpi",
      "metadata",
      "validation",
      "complete",
    ]);
    expect(progressFor("loading")).toEqual({
      stage: "loading",
      step: 1,
      totalSteps: 9,
      fraction: 1 / 9,
    });
    expect(progressFor("complete").fraction).toBe(1);
  });

  it("has a user-facing message for every error code", () => {
    for (const message of Object.values(PROCESSING_ERROR_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
    }
  });

  it("accepts presets as output requirements (no CCC logic in the engine)", () => {
    const requirements: OutputRequirements = CCC_PHOTO;
    expect(requirements.width).toBe(132);
  });
});
