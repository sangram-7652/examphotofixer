import type { ImagePreset, RequirementSource } from "./types";

/**
 * NIELIT CCC upload requirements.
 *
 * The numbers below were supplied by the project owner as verified. The
 * official source URL, document title and version have not yet been recorded;
 * fill them in (and switch status to "verified") before public launch.
 * Do not change any value here without an official source. See docs/FORM_PRESETS.md.
 */
const CCC_SOURCE: RequirementSource = {
  authority: "NIELIT",
  document: null,
  url: null,
  version: null,
  verifiedOn: null,
  status: "project-input",
  notes: "Supplied as verified by project owner; official source URL pending.",
};

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
  source: CCC_SOURCE,
};

export const CCC_PRESETS = [CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB] as const;
