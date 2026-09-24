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

/** Signature and left thumb impression share the same flow; wording comes from the preset. */
function cccInkContent(preset: ImagePreset, kind: "signature" | "thumb"): ToolContent {
  const d = describe(preset);
  const noun = kind === "signature" ? "signature" : "left thumb impression";
  const short = kind === "signature" ? "signature" : "thumb impression";
  const citation = sourceCitation(preset.source);
  const guidance = preset.guidance ?? [];
  return {
    intro: `Resize your ${noun} to the CCC upload requirements — ${d.size}, ${d.kb}, ${d.format}, ${d.dpi} — and check it before you upload. The image is processed on your device and never uploaded to our servers.`,
    howItWorks: [
      `Prepare your ${noun} as the guidelines describe (see “The same guidelines also ask” below), then scan it or capture an image of it.`,
      `Choose the image and drag or zoom so the ${short} fills the frame. The frame has the required ${preset.width}:${preset.height} shape, so nothing is stretched.`,
      `Tap “Process ${short}”. We resize to exactly ${d.size}, compress to fit ${d.kb} at the best possible quality, and set the DPI.`,
      "Check the results list, then download the JPG and upload it to the CCC form.",
    ],
    commonProblems: [
      {
        title: `${kind === "signature" ? "Signature" : "Thumb impression"} too small in the frame`,
        body: `Zoom in so the ${short} fills most of the frame. Extra blank paper around it is kept in the image and makes it harder to read.`,
      },
      {
        title: "“Invalid dimensions” on the form",
        body: `The form checks exact pixel sizes. Scans and camera images are usually thousands of pixels wide; this tool outputs exactly ${d.size}.`,
      },
      {
        title: `File is below ${preset.fileSizeKB.min} KB`,
        body: `A ${short} on plain white paper is very simple, so it compresses to a small file. We keep the highest-quality version and tell you if it is below ${preset.fileSizeKB.min} KB, instead of adding artificial data.`,
      },
    ],
    faq: [
      {
        question: `What size should the CCC ${noun} be?`,
        answer: `According to the ${citation}: ${d.size} (width × height), between ${d.kb}, in ${d.format} format, at ${d.dpi}. Older versions of the guidelines listed different values, so always check the current version before you upload.`,
      },
      ...(guidance.length > 0
        ? [
            {
              question: `How should I prepare the ${noun}?`,
              answer: `${guidance.join(" ")} This tool fixes the size, file size, format and DPI; it can't change how the ${short} was made.`,
            },
          ]
        : []),
      {
        question: `Why is my ${short} below ${preset.fileSizeKB.min} KB?`,
        answer: `Simple dark-on-white images compress to very small files. If the result is still under ${preset.fileSizeKB.min} KB at maximum quality, we keep that version rather than padding the file. You can still download it; if the form rejects it, try a sharper, higher-resolution scan.`,
      },
      {
        question: "Is my image uploaded to your server?",
        answer: "No. Everything happens inside your browser; the image never leaves your device.",
      },
      {
        question: "Is ExamPhotoFixer affiliated with NIELIT?",
        answer:
          "No. ExamPhotoFixer is an independent tool and is not affiliated with NIELIT or any exam body.",
      },
    ],
  };
}

function cccPackContent(presets: ImagePreset[]): ToolContent {
  const list = presets
    .map((preset) => {
      const d = describe(preset);
      return `${preset.label.replace(/^CCC /, "")}: ${d.size}, ${d.kb}, ${d.dpi}`;
    })
    .join("; ");
  const format = describe(presets[0]).format;
  return {
    intro: `Prepare all three CCC application images on one page — photo, signature and left thumb impression — check each against the requirements and download them together as a ZIP. Everything is processed on your device.`,
    howItWorks: [
      "Work through the three steps on this page: photo, signature, then left thumb impression.",
      "For each file: choose the image, adjust the crop, and process it. Each file is checked against its own requirements.",
      "The pack status shows which files are ready, which have a warning and which still need attention.",
      "When all three are processed, download them together as one ZIP — or download each file on its own.",
    ],
    commonProblems: [
      {
        title: "Mixing up the photo and signature sizes",
        body: "The photo is portrait and the signature/thumb are landscape, with different file-size limits. Each step here uses the right requirements automatically.",
      },
      {
        title: "Losing track of which file is ready",
        body: "The pack status lists every file with its state in words — Ready, Below minimum file size, or needs attention — so nothing is missed.",
      },
    ],
    faq: [
      {
        question: "What are the CCC application image requirements?",
        answer: `According to the ${sourceCitation(presets[0].source)}: ${list}. All three must be ${format}.`,
      },
      {
        question: "What is in the ZIP file?",
        answer:
          "Exactly the three processed JPG files shown on this page, named for each document. The ZIP is created in your browser; nothing is uploaded.",
      },
      {
        question: "Can I download the pack if one file is below the minimum size?",
        answer:
          "Yes. We keep the highest-quality version instead of adding artificial data, and show a warning. The application website may still enforce its own minimum-size check.",
      },
      {
        question: "Is ExamPhotoFixer affiliated with NIELIT?",
        answer:
          "No. ExamPhotoFixer is an independent tool and is not affiliated with NIELIT or any exam body.",
      },
    ],
  };
}

const CONTENT: Partial<
  Record<ToolDefinition["id"], (presets: ImagePreset[]) => ToolContent | null>
> = {
  "ccc-photo": (presets) => (presets.length === 1 ? cccPhotoContent(presets[0]) : null),
  "ccc-signature": (presets) =>
    presets.length === 1 ? cccInkContent(presets[0], "signature") : null,
  "ccc-thumb": (presets) => (presets.length === 1 ? cccInkContent(presets[0], "thumb") : null),
  "ccc-pack": (presets) => (presets.length > 1 ? cccPackContent(presets) : null),
};

export function getToolContent(tool: ToolDefinition, presets: ImagePreset[]): ToolContent | null {
  return CONTENT[tool.id]?.(presets) ?? null;
}
