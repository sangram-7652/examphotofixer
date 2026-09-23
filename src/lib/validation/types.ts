export type CheckId = "processing" | "dimensions" | "aspect-ratio" | "format" | "file-size" | "dpi";

/** `skipped` = could not be evaluated (e.g. processing failed earlier). */
export type CheckStatus = "pass" | "fail" | "skipped";

export interface ValidationCheck {
  id: CheckId;
  status: CheckStatus;
  /** Short label for the checklist, e.g. "Dimensions". */
  label: string;
  /** What the preset requires, human-readable. */
  expected: string;
  /** What the file has, human-readable. `null` if unknown. */
  actual: string | null;
  /** Actionable message shown on failure. */
  message: string | null;
}

export interface ValidationReport {
  presetId: string;
  /** True only when every check passed. */
  ready: boolean;
  checks: ValidationCheck[];
}
