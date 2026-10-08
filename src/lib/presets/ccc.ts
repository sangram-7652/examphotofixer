import type { ImagePreset, RequirementSource } from "./types";

/**
 * NIELIT CCC upload requirements.
 *
 * Source: "Guidelines and Instructions for Submission of Online Examination
 * Application Form (OEAF) and Examination Fee for Examination of Digital
 * Literacy Courses (DLC) – BCC/CCC/CCC+/ECC/ACC", Version 1.11 (2023),
 * page 3, sections A (photograph) and B (signature & left thumb impression).
 *
 * Older versions of these guidelines list different values. Do not change any
 * number here without a newer official version; update `source` in the same
 * change. See docs/FORM_PRESETS.md.
 *
 * Page 3 is both the PDF's own page index and its printed footer page number for this document
 * (no cover page offset) — confirmed directly against the SHA-256 below with `pdftotext`; see
 * docs/EXAM_REQUIREMENT_VERIFICATION.md.
 */
const CCC_SOURCE: RequirementSource = Object.freeze({
  id: "nielit-ccc-guidelines-v1.11",
  authority: "NIELIT",
  document: "CCC Examination Application Guidelines",
  url: "https://nva.nielit.gov.in/ccc/CCC_ExamGuideLine.pdf",
  version: "1.11",
  published: "2023",
  page: 3,
  sha256: "853cbfca530016fb934c3f78acb1dbdc1f9b6cdfc1e472f5947b259c4a3475aa",
  verifiedOn: "2026-09-25",
  status: "verified",
  notes:
    "Full title: Guidelines and Instructions for Submission of Online Examination Application " +
    "Form (OEAF) and Examination Fee for Examination of Digital Literacy Courses (DLC). Every " +
    "page footer reads 'Version1.11 (2023)'; PDF created 2023-06-14 (its embedded title still " +
    "names the Version 1.10 Word file). First verified 2026-09-24; re-verified unchanged (same " +
    "SHA-256) on 2026-09-25.",
});

export const CCC_PHOTO: ImagePreset = {
  id: "ccc-photo",
  exam: "ccc",
  documentType: "photo",
  label: "CCC Photo",
  width: 132,
  height: 170,
  fileSizeKB: { min: 5, max: 50 },
  dpi: { min: 96, max: 300 },
  formats: ["jpeg"],
  guidance: [
    "Use a recent colour photograph (taken within the last six months) with a white background.",
    "The guidelines ask for a professionally taken photo rather than one taken on a mobile phone.",
    "Your face must be clearly visible: no goggles, and no part of the face covered.",
  ],
  // "Size- 3.5 cm Width X 4.5 cm Height" (page 3, section A(i)); informational, see physicalSize.
  physicalSize: { widthCm: 3.5, heightCm: 4.5 },
  captureCaveat:
    "CCC guidance specifies a professionally taken photo, not a mobile-phone photo. Use Capture " +
    "only when it matches the applicable official requirements.",
  source: CCC_SOURCE,
};

export const CCC_SIGNATURE: ImagePreset = {
  id: "ccc-signature",
  exam: "ccc",
  documentType: "signature",
  label: "CCC Signature",
  width: 170,
  height: 132,
  fileSizeKB: { min: 5, max: 20 },
  dpi: { min: 96, max: 200 },
  formats: ["jpeg"],
  guidance: [
    "Sign on white paper using black or blue ink.",
    "The image must not be blurred or smudged.",
  ],
  // "Size- 4.5 cm Width X 3.5 cm Height" (page 3, section B(i)); informational, see physicalSize.
  physicalSize: { widthCm: 4.5, heightCm: 3.5 },
  source: CCC_SOURCE,
};

export const CCC_LEFT_THUMB: ImagePreset = {
  id: "ccc-left-thumb",
  exam: "ccc",
  documentType: "left-thumb-impression",
  label: "CCC Left Thumb Impression",
  width: 170,
  height: 132,
  fileSizeKB: { min: 5, max: 20 },
  dpi: { min: 96, max: 200 },
  formats: ["jpeg"],
  guidance: [
    "Take the left thumb impression on white paper using black or blue ink.",
    "The image must not be blurred or smudged.",
  ],
  // "Size- 4.5 cm Width X 3.5 cm Height" (page 3, section B(i)); informational, see physicalSize.
  physicalSize: { widthCm: 4.5, heightCm: 3.5 },
  source: CCC_SOURCE,
};

export const CCC_PRESETS = [CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB] as const;
