import { FORMAT_LABELS } from "@/lib/image/formats";
import type { ImagePreset } from "./types";

/** Human-readable requirement values, always derived from the preset. */
export function describePreset(preset: ImagePreset) {
  return {
    size: `${preset.width} × ${preset.height} pixels`,
    kb: `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`,
    format: preset.formats.map((f) => FORMAT_LABELS[f]).join(", "),
    dpi: `${preset.dpi.min}–${preset.dpi.max} DPI`,
  };
}
