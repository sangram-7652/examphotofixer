/**
 * Complete Pack state. Each asset reports the state of its own ImageTool;
 * the pack state is derived from all of them. Pure, so it is unit-tested.
 */

import type { ToolUiState } from "./result-state";

export type AssetState =
  "EMPTY" | "SELECTED" | "PROCESSING" | "READY" | "READY_WITH_WARNING" | "INVALID" | "ERROR";

export type PackState = "EMPTY" | "IN_PROGRESS" | "READY" | "READY_WITH_WARNING" | "INCOMPLETE";

/**
 * Maps an ImageTool state to an asset state. A file rejected on selection
 * (`SELECT` with an error) counts as ERROR until another file is chosen.
 */
export function assetStateFor(tool: ToolUiState | "UNSUPPORTED", hasError: boolean): AssetState {
  switch (tool) {
    case "SELECT":
      return hasError ? "ERROR" : "EMPTY";
    case "CROP":
      return "SELECTED";
    case "PROCESSING":
      return "PROCESSING";
    case "READY":
    case "READY_WITH_WARNING":
    case "INVALID":
    case "ERROR":
      return tool;
    case "UNSUPPORTED":
      return "ERROR";
  }
}

const DOWNLOADABLE: ReadonlySet<AssetState> = new Set(["READY", "READY_WITH_WARNING"]);

export function isDownloadable(state: AssetState): boolean {
  return DOWNLOADABLE.has(state);
}

/**
 * READY only when every asset is READY; READY_WITH_WARNING when every asset is
 * downloadable and at least one has a warning; INCOMPLETE when any asset failed.
 */
export function derivePackState(assets: readonly AssetState[]): PackState {
  if (assets.length > 0 && assets.every(isDownloadable)) {
    return assets.every((state) => state === "READY") ? "READY" : "READY_WITH_WARNING";
  }
  if (assets.some((state) => state === "INVALID" || state === "ERROR")) return "INCOMPLETE";
  if (assets.every((state) => state === "EMPTY")) return "EMPTY";
  return "IN_PROGRESS";
}

/** Status text shown next to each asset (never colour/icon alone). */
export const ASSET_STATE_TEXT: Readonly<Record<AssetState, string>> = {
  EMPTY: "Not started",
  SELECTED: "Selected — adjust crop and process",
  PROCESSING: "Processing",
  READY: "Ready",
  READY_WITH_WARNING: "Below minimum file size",
  INVALID: "Invalid — doesn't meet the requirements",
  ERROR: "Error — choose another file",
};
