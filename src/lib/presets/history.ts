/**
 * Requirement version history: every verification event for every source, append-only.
 *
 * Each event records what a person did with an official source on a date (first
 * verification, re-verification, a detected change) and a snapshot of the requirement values
 * of every preset it covers. `history.test.ts` requires the latest snapshot of each preset to
 * equal the live preset, so a value can't change without a new event, and older values stay
 * here as superseded versions. Never edit or delete a past event; add a new one.
 *
 * Process: docs/EXAM_REQUIREMENT_VERIFICATION.md. Status and review dates:
 * docs/REQUIREMENT_MONITORING.md (generated from this file by `npm run requirements:report`).
 */

import type { AcceptedFormat, DpiRange, NumericRange } from "./types";

/** Result of comparing the source against the previous verification. */
export type VerificationOutcome =
  /** First verification of these presets against this source. */
  | "INITIAL"
  /** Source re-read (same checksum, or text compared) and the requirements are unchanged. */
  | "UNCHANGED"
  /** The source or its requirements changed; the snapshot holds the new values. */
  | "CHANGED"
  /** The source changed or couldn't be compared conclusively; needs a person's review. */
  | "UNCERTAIN";

export interface RequirementSnapshot {
  width: number;
  height: number;
  preferredDimensions: boolean;
  fileSizeKB: NumericRange;
  dpi: DpiRange;
  formats: readonly AcceptedFormat[];
}

export interface VerificationEvent {
  sourceId: string;
  /** ISO date of the check. */
  date: string;
  outcome: VerificationOutcome;
  /** SHA-256 of the source file read on that date. */
  sha256: string;
  /** Printed version and publication date as read on that date. */
  version: string;
  published: string;
  /** Requirement values per preset id, as verified on that date. */
  presets: Readonly<Record<string, RequirementSnapshot>>;
  notes: string;
}

const CCC_PHOTO_V111: RequirementSnapshot = {
  width: 132,
  height: 170,
  preferredDimensions: false,
  fileSizeKB: { min: 5, max: 50 },
  dpi: { min: 96, max: 300 },
  formats: ["jpeg"],
};

const CCC_INK_V111: RequirementSnapshot = {
  width: 170,
  height: 132,
  preferredDimensions: false,
  fileSizeKB: { min: 5, max: 20 },
  dpi: { min: 96, max: 200 },
  formats: ["jpeg"],
};

const IBPS_PHOTO_RRBS_XV: RequirementSnapshot = {
  width: 200,
  height: 230,
  preferredDimensions: true,
  fileSizeKB: { min: 20, max: 50 },
  dpi: { min: 200, max: null },
  formats: ["jpeg"],
};

const CCC_SHA = "853cbfca530016fb934c3f78acb1dbdc1f9b6cdfc1e472f5947b259c4a3475aa";
const IBPS_RRBS_XV_SHA = "105b0652fb7f2564adc452685248734e8546235b332b84c93f81acdb1b760508";

export const VERIFICATION_HISTORY: readonly VerificationEvent[] = [
  {
    sourceId: "nielit-ccc-guidelines-v1.11",
    date: "2026-09-24",
    outcome: "INITIAL",
    sha256: CCC_SHA,
    version: "1.11",
    published: "2023",
    presets: {
      "ccc-photo": CCC_PHOTO_V111,
      "ccc-signature": CCC_INK_V111,
      "ccc-left-thumb": CCC_INK_V111,
    },
    notes: "Verified against page 3, sections A and B (P4).",
  },
  {
    sourceId: "ibps-crp-rrbs-xv-notification",
    date: "2026-09-24",
    outcome: "INITIAL",
    sha256: IBPS_RRBS_XV_SHA,
    version: "XV",
    published: "01.09.2026",
    presets: { "ibps-photo": IBPS_PHOTO_RRBS_XV },
    notes:
      "Annexure III, printed pp. 56 and 58; corroborated by CRP PO/MT-XVI and CSA-XVI (P8). " +
      "Corrigenda of 15.09.2026 and 21.09.2026: no image changes.",
  },
  {
    sourceId: "nielit-ccc-guidelines-v1.11",
    date: "2026-09-25",
    outcome: "UNCHANGED",
    sha256: CCC_SHA,
    version: "1.11",
    published: "2023",
    presets: {
      "ccc-photo": CCC_PHOTO_V111,
      "ccc-signature": CCC_INK_V111,
      "ccc-left-thumb": CCC_INK_V111,
    },
    notes: "Downloaded again over verified TLS: identical SHA-256 (P12 re-verification).",
  },
  {
    sourceId: "ibps-crp-rrbs-xv-notification",
    date: "2026-09-25",
    outcome: "UNCHANGED",
    sha256: IBPS_RRBS_XV_SHA,
    version: "XV",
    published: "01.09.2026",
    presets: {
      "ibps-photo": IBPS_PHOTO_RRBS_XV,
      // Added in P12 from the same, unchanged document (printed pp. 57–58).
      "ibps-signature": {
        width: 140,
        height: 60,
        preferredDimensions: true,
        fileSizeKB: { min: 10, max: 20 },
        dpi: { min: 200, max: null },
        formats: ["jpeg"],
      },
      "ibps-left-thumb": {
        width: 240,
        height: 240,
        preferredDimensions: true,
        fileSizeKB: { min: 20, max: 50 },
        dpi: { min: 200, max: null },
        formats: ["jpeg"],
      },
      "ibps-declaration": {
        width: 800,
        height: 400,
        preferredDimensions: true,
        fileSizeKB: { min: 50, max: 100 },
        dpi: { min: 200, max: null },
        formats: ["jpeg"],
      },
    },
    notes:
      "Downloaded again over verified TLS: identical SHA-256. All RRB XV corrigenda listed on " +
      "ibps.in checked (09.09, 15.09 and 21.09.2026; updated Annexure I; window notification): " +
      "none mentions image specifications. Signature, left thumb and declaration text identical " +
      "in CRP PO/MT-XVI and CRP SPL-XVI (punctuation and line wraps only). P12.",
  },
];

/** Every version of a preset's requirements, oldest first; the last one is current. */
export function requirementVersions(presetId: string): {
  snapshot: RequirementSnapshot;
  firstVerified: string;
  lastVerified: string;
  sourceId: string;
  sha256: string;
  status: "CURRENT" | "SUPERSEDED";
}[] {
  const versions: ReturnType<typeof requirementVersions> = [];
  for (const event of VERIFICATION_HISTORY) {
    const snapshot = event.presets[presetId];
    if (!snapshot) continue;
    const last = versions[versions.length - 1];
    const same =
      last !== undefined &&
      last.sourceId === event.sourceId &&
      JSON.stringify(last.snapshot) === JSON.stringify(snapshot);
    if (same) {
      last.lastVerified = event.date;
      last.sha256 = event.sha256;
    } else {
      if (last) last.status = "SUPERSEDED";
      versions.push({
        snapshot,
        firstVerified: event.date,
        lastVerified: event.date,
        sourceId: event.sourceId,
        sha256: event.sha256,
        status: "CURRENT",
      });
    }
  }
  return versions;
}

/** The most recent verification event for a source. */
export function latestEvent(sourceId: string): VerificationEvent | undefined {
  return [...VERIFICATION_HISTORY].reverse().find((event) => event.sourceId === sourceId);
}

/** The date a source was first verified (its earliest event — always appended first). */
export function firstVerifiedOn(sourceId: string): string | undefined {
  return VERIFICATION_HISTORY.find((event) => event.sourceId === sourceId)?.date;
}
