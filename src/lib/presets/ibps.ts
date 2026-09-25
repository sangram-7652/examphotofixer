import type { ImagePreset, RequirementSource } from "./types";

/**
 * IBPS Common Recruitment Process — uploaded photograph, signature, left thumb
 * impression and hand-written declaration.
 *
 * Canonical source: "CRP RRBs XV" Detailed Notification dated 01.09.2026,
 * Annexure III "Guidelines for Scanning and Upload of Documents" — photograph on
 * printed page 56; signature, left thumb impression and hand-written declaration
 * on printed page 57; file format and scanner resolution (all images) on printed
 * page 58. The same text appears in the CRP PO/MT-XVI, CRP SPL-XVI and CRP CSA-XVI
 * notifications (see docs/EXAM_REQUIREMENT_VERIFICATION.md).
 *
 * Do not change any value without re-verifying a newer official notification;
 * record it as a new verification event. See docs/FORM_PRESETS.md.
 */
const IBPS_CRP_RRBS_XV: RequirementSource = Object.freeze({
  id: "ibps-crp-rrbs-xv-notification",
  authority: "IBPS",
  document: "CRP RRBs Detailed Notification",
  url: "https://www.ibps.in/wp-content/uploads/CRP-RRBs-XV-notification.pdf",
  version: "XV",
  published: "01.09.2026",
  page: 56,
  sha256: "105b0652fb7f2564adc452685248734e8546235b332b84c93f81acdb1b760508",
  verifiedOn: "2026-09-25",
  status: "verified",
  notes:
    "Common Recruitment Process for RRBs, round XV (Officers and Office Assistants). Annexure III: " +
    "photograph on printed page 56 (PDF page 58); signature, left thumb impression and hand-written " +
    "declaration on printed page 57 (PDF page 59); 'The image file should be JPG or JPEG format' and " +
    "'Set the scanner resolution to a minimum of 200 dpi' on printed page 58 (PDF page 60). Date per " +
    "IBPS corrigenda ('Detailed Notification dated 01.09.2026'); the PDF's embedded creation date is " +
    "2026-08-31. Corrigenda of 09.09.2026 and 15.09.2026 (vacancies) and 21.09.2026 (registration " +
    "extended to 27.09.2026) leave all other terms unchanged. Re-verified unchanged (same SHA-256) " +
    "on 2026-09-25.",
});

export const IBPS_PHOTO: ImagePreset = {
  id: "ibps-photo",
  exam: "ibps",
  documentType: "photo",
  label: "IBPS Photo",
  width: 200,
  height: 230,
  preferredDimensions: true,
  fileSizeKB: { min: 20, max: 50 },
  dpi: { min: 200, max: null },
  formats: ["jpeg"],
  sourcePages: [56, 58],
  guidance: [
    "Use a recent passport-style colour photograph taken against a light-coloured, preferably white, background.",
    "Look straight at the camera with a relaxed face, without harsh shadows or red-eye.",
    "Caps, hats and dark glasses are not acceptable. If you wear glasses, there should be no reflections. Religious headwear is allowed but must not cover your face.",
    "During the online application you must also capture and upload a photograph with a webcam or mobile phone, in addition to this uploaded photograph.",
  ],
  source: IBPS_CRP_RRBS_XV,
};

export const IBPS_SIGNATURE: ImagePreset = {
  id: "ibps-signature",
  exam: "ibps",
  documentType: "signature",
  label: "IBPS Signature",
  width: 140,
  height: 60,
  preferredDimensions: true,
  fileSizeKB: { min: 10, max: 20 },
  // Page 58: "Set the scanner resolution to a minimum of 200 dpi" (applies to every image).
  dpi: { min: 200, max: null },
  formats: ["jpeg"],
  sourcePages: [57, 58],
  guidance: [
    "Sign on white paper with a black ink pen.",
    "Don't sign in CAPITAL LETTERS; the signature must be clearly visible.",
    "The signature must be your own. A signature at the exam that doesn't match the uploaded one can lead to disqualification.",
  ],
  source: IBPS_CRP_RRBS_XV,
};

export const IBPS_LEFT_THUMB: ImagePreset = {
  id: "ibps-left-thumb",
  exam: "ibps",
  documentType: "left-thumb-impression",
  label: "IBPS Left Thumb Impression",
  width: 240,
  height: 240,
  preferredDimensions: true,
  fileSizeKB: { min: 20, max: 50 },
  // "240 x 240 pixels in 200 DPI (Preferred…)"; page 58 sets a minimum of 200 dpi.
  dpi: { min: 200, max: null },
  formats: ["jpeg"],
  sourcePages: [57, 58],
  guidance: [
    "Put your left thumb impression on white paper with black or blue ink.",
    "If you don't have a left thumb, the notification says which finger (or toe) to use instead, and that you must write in the uploaded image which finger and hand (or toe) it is.",
  ],
  source: IBPS_CRP_RRBS_XV,
};

export const IBPS_DECLARATION: ImagePreset = {
  id: "ibps-declaration",
  exam: "ibps",
  documentType: "handwritten-declaration",
  label: "IBPS Hand-written Declaration",
  width: 800,
  height: 400,
  preferredDimensions: true,
  fileSizeKB: { min: 50, max: 100 },
  // "800 x 400 pixels in 200 DPI (Preferred…)"; page 58 sets a minimum of 200 dpi.
  dpi: { min: 200, max: null },
  formats: ["jpeg"],
  sourcePages: [57, 58],
  guidance: [
    "Write the declaration yourself, in English only, clearly on white paper with black ink. The notification gives the exact text to write.",
    "Don't write in CAPITAL LETTERS. A declaration written by someone else or in another language makes the application invalid.",
    "Candidates who cannot write may upload the typed declaration text with their left thumb impression below it, as the notification describes.",
  ],
  source: IBPS_CRP_RRBS_XV,
};

export const IBPS_PRESETS = [
  IBPS_PHOTO,
  IBPS_SIGNATURE,
  IBPS_LEFT_THUMB,
  IBPS_DECLARATION,
] as const;
