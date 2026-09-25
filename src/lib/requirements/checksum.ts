/**
 * Source checksum comparison for the source-change workflow. Pure: takes bytes that a developer
 * downloaded from the official site and compares them with what was verified. It never changes
 * a preset: a different checksum only opens a review (docs/EXAM_REQUIREMENT_VERIFICATION.md).
 */

import { createHash } from "node:crypto";
import { VERIFICATION_HISTORY } from "@/lib/presets/history";

export type ChecksumResult =
  | { outcome: "UNCHANGED"; sha256: string; bytes: number; sourceId: string; verifiedOn: string }
  | { outcome: "CHANGED"; sha256: string; bytes: number; sourceId: string; recorded: string }
  | { outcome: "UNKNOWN_SOURCE"; sha256: string; bytes: number }
  | { outcome: "NOT_COMPARED"; sha256: string; bytes: number };

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Recorded checksums per source id, latest event last. */
export function recordedChecksums(): Map<string, { sha256: string; date: string }[]> {
  const bySource = new Map<string, { sha256: string; date: string }[]>();
  for (const event of VERIFICATION_HISTORY) {
    const list = bySource.get(event.sourceId) ?? [];
    list.push({ sha256: event.sha256, date: event.date });
    bySource.set(event.sourceId, list);
  }
  return bySource;
}

/**
 * Compares a downloaded file with the latest recorded checksum of `sourceId`, or with an
 * explicit expected checksum. Without either, only reports the checksum.
 */
export function compareSource(
  bytes: Uint8Array,
  target: { sourceId?: string; expected?: string } = {},
): ChecksumResult {
  const sha256 = sha256Hex(bytes);
  const size = bytes.byteLength;
  if (target.expected) {
    const expected = target.expected.toLowerCase();
    return expected === sha256
      ? {
          outcome: "UNCHANGED",
          sha256,
          bytes: size,
          sourceId: target.sourceId ?? "(expected)",
          verifiedOn: "",
        }
      : {
          outcome: "CHANGED",
          sha256,
          bytes: size,
          sourceId: target.sourceId ?? "(expected)",
          recorded: expected,
        };
  }
  if (!target.sourceId) return { outcome: "NOT_COMPARED", sha256, bytes: size };
  const recorded = recordedChecksums().get(target.sourceId);
  if (!recorded || recorded.length === 0) return { outcome: "UNKNOWN_SOURCE", sha256, bytes: size };
  const latest = recorded[recorded.length - 1];
  return latest.sha256 === sha256
    ? {
        outcome: "UNCHANGED",
        sha256,
        bytes: size,
        sourceId: target.sourceId,
        verifiedOn: latest.date,
      }
    : {
        outcome: "CHANGED",
        sha256,
        bytes: size,
        sourceId: target.sourceId,
        recorded: latest.sha256,
      };
}
