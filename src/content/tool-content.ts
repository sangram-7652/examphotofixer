/**
 * Editorial content for tool pages. Requirement numbers are always read from
 * the preset — never typed into copy — so content can't drift from the data.
 */

import { FORMAT_LABELS } from "@/lib/image/formats";
import { sourceCitation } from "@/lib/presets/source";
import type { ImagePreset } from "@/lib/presets/types";
import type { ToolDefinition } from "@/lib/tools/registry";

export interface QA {
  question: string;
  answer: string;
}

export interface ToolContent {
  /** One or two sentences under the H1. */
  intro: string;
  howItWorks: string[];
  commonProblems: { title: string; body: string }[];
  faq: QA[];
}

function describe(preset: ImagePreset) {
  return {
    size: `${preset.width} × ${preset.height} pixels`,
    kb: `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`,
    format: preset.formats.map((f) => FORMAT_LABELS[f]).join(", "),
    dpi: `${preset.dpi.min}–${preset.dpi.max} DPI`,
  };
}

function cccPhotoContent(preset: ImagePreset): ToolContent {
  const d = describe(preset);
  return {
    intro: `Resize your photo to the CCC upload requirements — ${d.size}, ${d.kb}, ${d.format} — and check it before you upload. Your photo is processed on your device and never uploaded to our servers.`,
    howItWorks: [
      "Choose your photo — for example a scan or digital copy of a recent passport-style photo. Check the photo guidelines further down this page.",
      `Drag and zoom so your face fills the frame. The frame already has the required ${preset.width}:${preset.height} shape, so your photo is cropped, never stretched.`,
      `Tap “Process photo”. We fix the orientation, resize to exactly ${d.size}, compress it to fit ${d.kb} at the best possible quality, and set the DPI.`,
      "Check the results list, then download the JPG and upload it to the CCC form.",
    ],
    commonProblems: [
      {
        title: "“Invalid dimensions” on the form",
        body: `The form checks exact pixel sizes. Phone photos are usually thousands of pixels wide. This tool outputs exactly ${d.size}.`,
      },
      {
        title: "“File size too large”",
        body: `Camera photos are often several megabytes. The tool compresses to fit within ${d.kb} while keeping the highest quality that fits.`,
      },
      {
        title: "Photo appears sideways",
        body: "Phones store rotation separately from the image. The tool reads it and saves the photo the right way up.",
      },
      {
        title: "Face looks squashed or stretched",
        body: "Resizing without cropping distorts the image. The tool crops to the required shape first, so proportions stay natural.",
      },
    ],
    faq: [
      {
        question: "What size should the CCC photo be?",
        answer: `According to the ${sourceCitation(preset.source)}: ${d.size} (width × height), between ${d.kb}, in ${d.format} format, at ${d.dpi}. Older versions of the guidelines listed different values, so always check the current version before you upload.`,
      },
      {
        question: "Is my photo uploaded to your server?",
        answer:
          "No. Cropping, resizing and compression all happen inside your browser. The photo never leaves your device.",
      },
      {
        question: "Which files can I use?",
        answer:
          "JPG, PNG or WebP images up to 25 MB, such as a scan or digital copy of your photo. The result is always a JPG.",
      },
      ...(preset.guidance && preset.guidance.length > 0
        ? [
            {
              question: "What kind of photo do the guidelines ask for?",
              answer: `${preset.guidance.join(" ")} This tool fixes the size, file size, format and DPI; it can't change how or when the photo was taken.`,
            },
          ]
        : []),
      {
        question: "Why does the tool say my file is below the minimum size?",
        answer: `Very plain images (for example, a face on a smooth, even background) compress to very small files. If your photo is still under ${preset.fileSizeKB.min} KB at maximum quality, we keep that best-quality version rather than adding artificial data. You can still download it; if the form rejects it, try a sharper, higher-resolution original.`,
      },
      {
        question: "What DPI does the tool set?",
        answer: `The photo's DPI is set within the required ${d.dpi} range. DPI is information stored in the file; it doesn't change the pixel size.`,
      },
      {
        question: "Is ExamPhotoFixer affiliated with NIELIT?",
        answer:
          "No. ExamPhotoFixer is an independent tool and is not affiliated with NIELIT or any exam body.",
      },
    ],
  };
}

const CONTENT: Partial<Record<ToolDefinition["id"], (preset: ImagePreset) => ToolContent>> = {
  "ccc-photo": cccPhotoContent,
};

export function getToolContent(tool: ToolDefinition, presets: ImagePreset[]): ToolContent | null {
  const build = CONTENT[tool.id];
  return build && presets.length === 1 ? build(presets[0]) : null;
}
