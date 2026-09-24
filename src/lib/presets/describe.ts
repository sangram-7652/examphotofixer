import { FORMAT_LABELS } from "@/lib/image/formats";
import type { DpiRange, ImagePreset } from "./types";

/** Human-readable requirement values, always derived from the preset. */
export function describePreset(preset: ImagePreset) {
  return {
    size: `${preset.width} × ${preset.height} pixels`,
    kb: `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`,
    format: preset.formats.map((f) => FORMAT_LABELS[f]).join(", "),
    dpi: dpiText(preset.dpi),
  };
}

/** "96–300 DPI", or "at least 200 DPI" when the source states only a minimum. */
export function dpiText(range: DpiRange): string {
  return range.max === null ? `at least ${range.min} DPI` : `${range.min}–${range.max} DPI`;
}

/** Short form for compact summaries: "96–300" or "200 or more". */
export function dpiShortText(range: DpiRange): string {
  return range.max === null ? `${range.min} or more` : `${range.min}–${range.max}`;
}
