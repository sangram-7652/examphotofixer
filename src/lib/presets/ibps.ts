import type { ImagePreset, RequirementSource } from "./types";

/**
 * IBPS Common Recruitment Process — uploaded photograph.
 *
 * Canonical source: "CRP RRBs XV" Detailed Notification dated 01.09.2026,
 * Annexure III "Guidelines for Scanning and Upload of Documents" — photograph on
 * printed page 56, file format and scanner resolution on printed page 58.
 * The same photograph text appears in the CRP PO/MT-XVI and CRP CSA-XVI
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
  verifiedOn: "2026-09-24",
  status: "verified",
  notes:
    "Common Recruitment Process for RRBs, round XV (Officers and Office Assistants). Annexure III: " +
    "photograph on printed page 56 (PDF page 58); 'The image file should be JPG or JPEG format' and " +
    "'Set the scanner resolution to a minimum of 200 dpi' on printed page 58 (PDF page 60). Date per " +
    "IBPS corrigenda ('Detailed Notification dated 01.09.2026'); the PDF's embedded creation date is " +
    "2026-08-31. Corrigenda of 15.09.2026 (vacancies) and 21.09.2026 (registration extended to " +
    "27.09.2026) leave all other terms unchanged.",
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
  guidance: [
    "Use a recent passport-style colour photograph taken against a light-coloured, preferably white, background.",
    "Look straight at the camera with a relaxed face, without harsh shadows or red-eye.",
    "Caps, hats and dark glasses are not acceptable. If you wear glasses, there should be no reflections. Religious headwear is allowed but must not cover your face.",
    "During the online application you must also capture and upload a photograph with a webcam or mobile phone, in addition to this uploaded photograph.",
  ],
  source: IBPS_CRP_RRBS_XV,
};

export const IBPS_PRESETS = [IBPS_PHOTO] as const;
