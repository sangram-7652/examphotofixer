/**
 * Stable, machine-readable reason codes for analytics, derived from the
 * engine's own validation report and output facts. Nothing here re-decides
 * pass/fail; it only names why the engine said a check failed.
 */

import type { CheckId, ValidationCheck } from "@/lib/validation/types";

export type ValidationReasonCode =
  | "PROCESSING_FAILED"
  | "DIMENSIONS_MISMATCH"
  | "ASPECT_RATIO_MISMATCH"
  | "FORMAT_MISMATCH"
  | "FILE_TOO_SMALL"
  | "FILE_TOO_LARGE"
  | "FILE_SIZE_OUT_OF_RANGE"
  | "DPI_MISSING"
  | "DPI_OUT_OF_RANGE"
  | "METADATA_PRESENT"
  /** Generic compressor outcomes (see lib/tools/generic/compress.ts). */
  | "COMPRESSION_LIMIT_NOT_REACHED"
  | "OUTPUT_LARGER_THAN_ORIGINAL";

interface ReasonInput {
  checks: readonly Pick<ValidationCheck, "id" | "status">[];
  /** The engine's compression status, e.g. "below_minimum" or "above_maximum". */
  compressionStatus?: string;
  outputDpi?: { x: number; y: number } | null;
}

function reasonFor(id: CheckId, input: ReasonInput): ValidationReasonCode {
  switch (id) {
    case "processing":
      return "PROCESSING_FAILED";
    case "dimensions":
      return "DIMENSIONS_MISMATCH";
    case "aspect-ratio":
      return "ASPECT_RATIO_MISMATCH";
    case "format":
      return "FORMAT_MISMATCH";
    case "file-size":
      return input.compressionStatus === "below_minimum"
        ? "FILE_TOO_SMALL"
        : input.compressionStatus === "above_maximum"
          ? "FILE_TOO_LARGE"
          : "FILE_SIZE_OUT_OF_RANGE";
    case "dpi":
      return input.outputDpi === null ? "DPI_MISSING" : "DPI_OUT_OF_RANGE";
    case "metadata":
      return "METADATA_PRESENT";
  }
}

/** Reason codes for every failed check, in report order (deduplicated). */
export function validationReasonCodes(input: ReasonInput): ValidationReasonCode[] {
  const codes = input.checks
    .filter((check) => check.status === "fail")
    .map((check) => reasonFor(check.id, input));
  return [...new Set(codes)];
}

/** The primary reason: the first failed check. `undefined` if nothing failed. */
export function primaryReasonCode(input: ReasonInput): ValidationReasonCode | undefined {
  return validationReasonCodes(input)[0];
}
