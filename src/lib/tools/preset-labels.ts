import { EXAMS } from "@/lib/presets/exams";
import type { DocumentType, ImagePreset } from "@/lib/presets/types";

const FILE_LABELS: Readonly<Record<DocumentType, string>> = {
  photo: "Photo",
  signature: "Signature",
  "left-thumb-impression": "Left_Thumb",
  "handwritten-declaration": "Declaration",
};

const NOUNS: Readonly<Record<DocumentType, string>> = {
  photo: "photo",
  signature: "signature",
  "left-thumb-impression": "thumb impression",
  "handwritten-declaration": "declaration",
};

/** Download filename derived from the preset, e.g. "CCC_Photo_132x170.jpg". */
export function buildDownloadFilename(preset: ImagePreset): string {
  const exam = EXAMS[preset.exam].shortName.replace(/[^A-Za-z0-9]+/g, "_");
  return `${exam}_${FILE_LABELS[preset.documentType]}_${preset.width}x${preset.height}.jpg`;
}

/** ZIP filename for a set of files from one exam, e.g. "CCC_Complete_Pack.zip". */
export function buildPackFilename(exam: ImagePreset["exam"]): string {
  return `${EXAMS[exam].shortName.replace(/[^A-Za-z0-9]+/g, "_")}_Complete_Pack.zip`;
}

/** Short title-case label for pack status rows: "Photo", "Signature", "Left thumb impression". */
export function documentTitle(preset: ImagePreset): string {
  const noun =
    preset.documentType === "left-thumb-impression"
      ? "left thumb impression"
      : preset.documentType === "handwritten-declaration"
        ? "handwritten declaration"
        : NOUNS[preset.documentType];
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** Lower-case noun for UI copy: "photo", "signature", "thumb impression". */
export function documentNoun(preset: ImagePreset): string {
  return NOUNS[preset.documentType];
}
