import { CCC_PRESETS } from "./ccc";
import { IBPS_PRESETS } from "./ibps";
import type { ExamId, ImagePreset } from "./types";

export * from "./types";
export { EXAMS, listExams } from "./exams";

const ALL_PRESETS: readonly ImagePreset[] = [...CCC_PRESETS, ...IBPS_PRESETS];

const PRESETS_BY_ID = new Map(ALL_PRESETS.map((preset) => [preset.id, preset]));

export function listPresets(): readonly ImagePreset[] {
  return ALL_PRESETS;
}

export function getPreset(id: string): ImagePreset {
  const preset = PRESETS_BY_ID.get(id);
  if (!preset) {
    throw new Error(`Unknown preset: ${id}`);
  }
  return preset;
}

export function presetsForExam(exam: ExamId): ImagePreset[] {
  return ALL_PRESETS.filter((preset) => preset.exam === exam);
}
