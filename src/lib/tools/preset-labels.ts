import { EXAMS } from "@/lib/presets/exams";
import type { DocumentType, ImagePreset } from "@/lib/presets/types";

const FILE_LABELS: Readonly<Record<DocumentType, string>> = {
  photo: "Photo",
  signature: "Signature",
  "left-thumb-impression": "Left_Thumb",
};

const NOUNS: Readonly<Record<DocumentType, string>> = {
  photo: "photo",
  signature: "signature",
  "left-thumb-impression": "thumb impression",
};

/** Download filename derived from the preset, e.g. "CCC_Photo_132x170.jpg". */
export function buildDownloadFilename(preset: ImagePreset): string {
  const exam = EXAMS[preset.exam].shortName.replace(/[^A-Za-z0-9]+/g, "_");
  return `${exam}_${FILE_LABELS[preset.documentType]}_${preset.width}x${preset.height}.jpg`;
}

/** Lower-case noun for UI copy: "photo", "signature", "thumb impression". */
export function documentNoun(preset: ImagePreset): string {
  return NOUNS[preset.documentType];
}
