/**
 * Maps engine results to UI states and checklist rows. Presentation only:
 * pass/fail decisions come from the engine's validation report.
 */

import type { ImageProcessingResult } from "@/lib/image/worker/protocol";
import type { CheckId } from "@/lib/validation/types";

export type ResultState = "READY" | "READY_WITH_WARNING" | "INVALID";

export type ToolUiState = "SELECT" | "CROP" | "PROCESSING" | ResultState | "ERROR";

type ResultLike = Pick<ImageProcessingResult, "validation" | "compression">;

/** Non-blocking conditions: the file is usable but a stated requirement isn't met. */
function warningChecks(result: ResultLike): Set<CheckId> {
  return result.compression.status === "below_minimum" ? new Set(["file-size"]) : new Set();
}

export function deriveResultState(result: ResultLike): ResultState {
  if (result.validation.ready) return "READY";
  const warnings = warningChecks(result);
  const blocking = result.validation.checks.filter(
    (check) => check.status !== "pass" && !warnings.has(check.id),
  );
  return blocking.length === 0 && warnings.size > 0 ? "READY_WITH_WARNING" : "INVALID";
}

export type ChecklistStatus = "pass" | "warning" | "fail";

export interface ChecklistItem {
  id: CheckId;
  label: string;
  value: string;
  expected: string;
  status: ChecklistStatus;
  message: string | null;
}

/** Rows shown to the user, in display order. */
const DISPLAYED: readonly { id: CheckId; label: string }[] = [
  { id: "dimensions", label: "Dimensions" },
  { id: "file-size", label: "File size" },
  { id: "format", label: "Format" },
  { id: "dpi", label: "DPI" },
  { id: "metadata", label: "Location & camera data" },
];

export function buildChecklist(result: ResultLike): ChecklistItem[] {
  const warnings = warningChecks(result);
  return DISPLAYED.flatMap(({ id, label }) => {
    const check = result.validation.checks.find((c) => c.id === id);
    if (!check) return [];
    const status: ChecklistStatus =
      check.status === "pass" ? "pass" : warnings.has(id) ? "warning" : "fail";
    const value = id === "metadata" && check.status === "pass" ? "Removed" : (check.actual ?? "—");
    return [{ id, label, value, expected: check.expected, status, message: check.message }];
  });
}
