/**
 * Preset types. A preset is the single source of truth for an official
 * upload requirement. UI, validation and processing read requirements from
 * presets only — never hard-code numbers elsewhere.
 */

export type ExamId = "ccc" | "ssc" | "railway" | "upsc";

export type DocumentType = "photo" | "signature" | "left-thumb-impression";

/** Output formats a preset may accept. Extend only when a source requires it. */
export type AcceptedFormat = "jpeg";

/**
 * How much we trust a preset's numbers.
 * - `verified`: checked against an official source; `url` and `verifiedOn` are required.
 * - `project-input`: supplied by the project owner as verified, but the official
 *   source document/URL has not yet been recorded in this repository.
 * - `unverified`: must not be shown to users as a requirement.
 */
export type VerificationStatus = "verified" | "project-input" | "unverified";

export interface RequirementSource {
  /** Conducting body / authority, e.g. "NIELIT". */
  authority: string;
  /** Title of the notice, instruction page or brochure. */
  document: string | null;
  /** Official URL of the source. `null` until recorded — never guess one. */
  url: string | null;
  /** Version, edition or publication date of the source document. */
  version: string | null;
  /** ISO date (YYYY-MM-DD) on which a person last checked the source. */
  verifiedOn: string | null;
  status: VerificationStatus;
  notes?: string;
}

export interface NumericRange {
  min: number;
  max: number;
}

export interface ImagePreset {
  /** Stable id, e.g. "ccc-photo". Used in URLs, analytics and tests. */
  id: string;
  exam: ExamId;
  documentType: DocumentType;
  label: string;
  /** Exact required output width in pixels. */
  width: number;
  /** Exact required output height in pixels. */
  height: number;
  /** Allowed file size in KB exactly as written by the source. See docs/VALIDATION.md for byte interpretation. */
  fileSizeKB: NumericRange;
  /** Allowed DPI range (inclusive). */
  dpi: NumericRange;
  formats: readonly AcceptedFormat[];
  source: RequirementSource;
}

export interface ExamDefinition {
  id: ExamId;
  shortName: string;
  fullName: string;
  conductingBody: string;
  /** `active` exams have presets and tools; `planned` exams are searchable but have no requirements yet. */
  status: "active" | "planned";
}
