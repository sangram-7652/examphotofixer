/**
 * Guides: a small, task-focused content cluster. Requirement values are always
 * read from presets (never typed into copy), so a preset change updates every
 * guide. Sources are shown with the shared SourceVerification component.
 */

import { chooseOutputDpi } from "@/lib/image/dpi";
import { getPreset } from "@/lib/presets";
import { describePreset } from "@/lib/presets/describe";
import { sourceCitation } from "@/lib/presets/source";
import type { ImagePreset } from "@/lib/presets/types";
import { getTool, type ToolId } from "@/lib/tools/registry";
import type { QA } from "./tool-content";

export type GuideCategory = "CCC" | "Application Help";

/** Text with optional inline links (internal paths only). */
export type Inline = string | { href: string; text: string };

export type GuideBlock =
  | { kind: "p"; content: Inline[] }
  | { kind: "list"; items: Inline[][] }
  | { kind: "steps"; items: Inline[][] };

export interface GuideSection {
  id: string;
  heading: string;
  blocks: GuideBlock[];
}

export interface GuideBody {
  /** Direct answer shown under the H1. */
  shortAnswer: string;
  sections: GuideSection[];
  faq: QA[];
}

export interface Guide {
  slug: string;
  category: GuideCategory;
  /** H1. */
  title: string;
  metaTitle: string;
  description: string;
  /** One line for guide lists and tool pages. */
  summary: string;
  /** Presets whose requirements the guide shows (tables + source). */
  presetIds: readonly string[];
  /** Guide → tool links, with descriptive anchor text. */
  toolLinks: readonly { toolId: ToolId; text: string }[];
  /** ISO date the guide text was last reviewed. */
  reviewedOn: string;
  build: (presets: ImagePreset[]) => GuideBody;
}

const p = (...content: Inline[]): GuideBlock => ({ kind: "p", content });
const list = (...items: Inline[][]): GuideBlock => ({ kind: "list", items });
const steps = (...items: Inline[][]): GuideBlock => ({ kind: "steps", items });
const toolLink = (toolId: ToolId, text: string): Inline => ({ href: getTool(toolId).path, text });

const REVIEWED_ON = "2026-09-24";

const NO_GUARANTEE =
  "Meeting these technical values doesn't guarantee your application will be accepted — the exam body decides. Always check the current official instructions before you upload.";

function belowMinimumSection(preset: ImagePreset, noun: string): GuideSection {
  return {
    id: "below-minimum",
    heading: `If the file is below ${preset.fileSizeKB.min} KB`,
    blocks: [
      p(
        `Plain images compress very well, so a small ${noun} can come out under ${preset.fileSizeKB.min} KB even at the highest quality. ExamPhotoFixer keeps that highest-quality version and shows a warning instead of padding the file or adding artificial noise.`,
      ),
      p(
        `You can still download it. If the application website rejects it for being too small, start again from a sharper, higher-resolution original — more real detail produces a larger file.`,
      ),
    ],
  };
}

function sizeFaq(preset: ImagePreset, noun: string): QA[] {
  const d = describePreset(preset);
  return [
    {
      question: `Is ${preset.width} × ${preset.height} the width or the height?`,
      answer: `The first number is the width. The ${noun} should be ${preset.width} pixels wide and ${preset.height} pixels tall.`,
    },
    {
      question: `What does ${d.dpi} mean?`,
      answer: `DPI (also called PPI) is a value stored inside the image file. It doesn't change the pixel size. ExamPhotoFixer writes ${chooseOutputDpi(preset.dpi)} DPI, which is inside the stated ${d.dpi} range.`,
    },
    {
      question: "If my file meets these values, will my form be accepted?",
      answer: NO_GUARANTEE,
    },
  ];
}

const GUIDES: readonly Guide[] = [
  {
    slug: "ccc-photo-size",
    category: "CCC",
    title: "CCC Photo Size: Dimensions, File Size, Format and DPI",
    metaTitle: "CCC Photo Size – Dimensions, KB, Format & DPI Explained",
    description:
      "The photo size required for the NIELIT CCC application: pixel dimensions, file size in KB, format and DPI, with the source guideline and how to prepare your photo.",
    summary: "The photo dimensions, file size, format and DPI stated in the NIELIT guideline.",
    presetIds: ["ccc-photo"],
    toolLinks: [
      { toolId: "ccc-photo", text: "Resize your photo with the CCC Photo Resizer" },
      {
        toolId: "ccc-pack",
        text: "Prepare photo, signature and thumb together in the CCC Complete Pack",
      },
    ],
    reviewedOn: REVIEWED_ON,
    build: ([photo]) => {
      const d = describePreset(photo);
      return {
        shortAnswer: `According to the ${sourceCitation(photo.source)}, the CCC photograph should be ${d.size} (width × height), ${d.kb}, in ${d.format} format, at ${d.dpi}.`,
        sections: [
          {
            id: "prepare",
            heading: "How to prepare your photo",
            blocks: [
              steps(
                [
                  "Start from a recent colour photo that follows the guideline notes above — for example a scan or digital copy of a passport-style photo.",
                ],
                ["Open the ", toolLink("ccc-photo", "CCC Photo Resizer"), " and choose the photo."],
                [
                  `Drag and zoom so your face fills the frame. The frame already has the ${photo.width}:${photo.height} shape, so nothing is stretched.`,
                ],
                [
                  "Process the photo and check the results list, then download the JPG and upload it to the form.",
                ],
              ),
            ],
          },
          {
            id: "tool-vs-guideline",
            heading: "What the tool handles — and what it can't",
            blocks: [
              p("ExamPhotoFixer takes care of the technical values:"),
              list(
                [`Exact size of ${d.size}, cropped rather than stretched`],
                [`File size within ${d.kb}, at the best quality that fits`],
                [`${d.format} output with ${chooseOutputDpi(photo.dpi)} DPI written into the file`],
                ["Correct orientation, and location/camera details removed"],
              ),
              p(
                "It can't change what the photo shows. Background, recency and how the photo was taken are up to you, as the guideline describes.",
              ),
            ],
          },
          belowMinimumSection(photo, "photo"),
        ],
        faq: sizeFaq(photo, "photo"),
      };
    },
  },
  {
    slug: "ccc-signature-size",
    category: "CCC",
    title: "CCC Signature Size: Dimensions, File Size, Format and DPI",
    metaTitle: "CCC Signature Size – Dimensions, KB, Format & DPI Explained",
    description:
      "The signature size required for the NIELIT CCC application: pixel dimensions, file size in KB, format, DPI and the ink and paper the guideline asks for.",
    summary: "Signature dimensions, file size, format, DPI and the paper and ink to use.",
    presetIds: ["ccc-signature"],
    toolLinks: [
      { toolId: "ccc-signature", text: "Resize your signature with the CCC Signature Resizer" },
      { toolId: "ccc-pack", text: "Prepare all three CCC images in the CCC Complete Pack" },
    ],
    reviewedOn: REVIEWED_ON,
    build: ([signature]) => {
      const d = describePreset(signature);
      return {
        shortAnswer: `According to the ${sourceCitation(signature.source)}, the CCC signature image should be ${d.size} (width × height), ${d.kb}, in ${d.format} format, at ${d.dpi}.`,
        sections: [
          {
            id: "prepare",
            heading: "How to prepare your signature",
            blocks: [
              steps(
                [
                  "Sign on white paper with black or blue ink, as the guideline asks. A clear, unsmudged signature works best.",
                ],
                ["Scan it, or capture an image of it in good light."],
                [
                  "Open the ",
                  toolLink("ccc-signature", "CCC Signature Resizer"),
                  " and choose the image.",
                ],
                [
                  `Zoom so the signature fills most of the ${signature.width}:${signature.height} frame — extra blank paper makes it harder to read.`,
                ],
                ["Process it, check the results list and download the JPG."],
              ),
            ],
          },
          {
            id: "tool-vs-guideline",
            heading: "What the tool handles — and what it can't",
            blocks: [
              list(
                [`Exact size of ${d.size}, cropped rather than stretched`],
                [`File size within ${d.kb} where the image allows it`],
                [
                  `${d.format} output with ${chooseOutputDpi(signature.dpi)} DPI written into the file`,
                ],
              ),
              p(
                "It can't fix a faint, blurred or smudged signature. If the result looks unclear, sign again and rescan.",
              ),
            ],
          },
          belowMinimumSection(signature, "signature"),
        ],
        faq: sizeFaq(signature, "signature"),
      };
    },
  },
  {
    slug: "ccc-thumb-impression-size",
    category: "CCC",
    title: "CCC Left Thumb Impression Size: Dimensions, File Size, Format and DPI",
    metaTitle: "CCC Thumb Impression Size – Dimensions, KB, Format & DPI",
    description:
      "The left thumb impression (LTI) size required for the NIELIT CCC application: pixel dimensions, file size, format, DPI and how to prepare the impression.",
    summary: "Left thumb impression dimensions, file size, format, DPI and preparation.",
    presetIds: ["ccc-left-thumb"],
    toolLinks: [
      {
        toolId: "ccc-thumb",
        text: "Resize your thumb impression with the CCC Thumb Impression Resizer",
      },
      { toolId: "ccc-pack", text: "Prepare all three CCC images in the CCC Complete Pack" },
    ],
    reviewedOn: REVIEWED_ON,
    build: ([thumb]) => {
      const d = describePreset(thumb);
      return {
        shortAnswer: `According to the ${sourceCitation(thumb.source)}, the CCC left thumb impression image should be ${d.size} (width × height), ${d.kb}, in ${d.format} format, at ${d.dpi}.`,
        sections: [
          {
            id: "prepare",
            heading: "How to prepare your left thumb impression",
            blocks: [
              steps(
                [
                  "The guideline asks for the left thumb. Take the impression on white paper using black or blue ink, pressing evenly so it isn't blurred or smudged.",
                ],
                ["Scan it, or capture an image of it in good light."],
                [
                  "Open the ",
                  toolLink("ccc-thumb", "CCC Thumb Impression Resizer"),
                  " and choose the image.",
                ],
                [`Zoom so the impression fills most of the ${thumb.width}:${thumb.height} frame.`],
                ["Process it, check the results list and download the JPG."],
              ),
            ],
          },
          {
            id: "tool-vs-guideline",
            heading: "What the tool handles — and what it can't",
            blocks: [
              list(
                [`Exact size of ${d.size}, cropped rather than stretched`],
                [`File size within ${d.kb} where the image allows it`],
                [`${d.format} output with ${chooseOutputDpi(thumb.dpi)} DPI written into the file`],
              ),
              p(
                "It can't make a smudged or faint impression clearer. If it's hard to see, take it again.",
              ),
            ],
          },
          belowMinimumSection(thumb, "thumb impression"),
        ],
        faq: sizeFaq(thumb, "thumb impression"),
      };
    },
  },
  {
    slug: "ccc-photo-upload-problems",
    category: "Application Help",
    title: "CCC Photo Upload Problems and How to Fix Them",
    metaTitle: "CCC Photo Upload Problems – Wrong Size, KB, Format or DPI Fixed",
    description:
      "Why a CCC application photo gets rejected — wrong dimensions, file too large or too small, wrong format, DPI, rotation or cropping — and how to fix each problem.",
    summary: "Fixes for wrong dimensions, file size, format, DPI, rotation and cropping.",
    presetIds: ["ccc-photo"],
    toolLinks: [
      { toolId: "ccc-photo", text: "Fix your photo with the CCC Photo Resizer" },
      { toolId: "image-resizer", text: "Change dimensions with the Image Resizer" },
      { toolId: "image-compressor", text: "Reduce file size with the Image Compressor" },
    ],
    reviewedOn: REVIEWED_ON,
    build: ([photo]) => {
      const d = describePreset(photo);
      return {
        shortAnswer: `Most CCC photo upload errors come from one of four values: dimensions (${d.size}), file size (${d.kb}), format (${d.format}) or DPI (${d.dpi}). Find your problem below.`,
        sections: [
          {
            id: "four-values",
            heading: "Dimensions, file size, format and DPI are different things",
            blocks: [
              list(
                [`Dimensions: the number of pixels across and down — ${d.size} for the CCC photo.`],
                [`File size: how much storage the file uses, in KB — ${d.kb}.`],
                [`Format: the file type — ${d.format}.`],
                [`DPI (PPI): a value stored in the file — ${d.dpi}. It doesn't change the pixels.`],
              ),
              p("Changing one doesn't fix the others, so check all four."),
            ],
          },
          {
            id: "wrong-dimensions",
            heading: "Photo dimensions are wrong",
            blocks: [
              p(
                `Phone and camera photos are thousands of pixels wide. Resizing straight to ${photo.width} × ${photo.height} can squash the face, so crop to the right shape first. The `,
                toolLink("ccc-photo", "CCC Photo Resizer"),
                " crops and resizes in one step.",
              ),
            ],
          },
          {
            id: "too-large",
            heading: "File is larger than allowed",
            blocks: [
              p(
                `Full-size photos are often several megabytes. The CCC Photo Resizer compresses to fit within ${d.kb}. For other forms with their own limit, the `,
                toolLink("image-compressor", "Image Compressor"),
                " keeps the dimensions and reduces the file below a maximum you choose.",
              ),
            ],
          },
          {
            id: "too-small",
            heading: `File is smaller than ${photo.fileSizeKB.min} KB`,
            blocks: [
              p(
                `A very plain photo can compress below ${photo.fileSizeKB.min} KB even at maximum quality. ExamPhotoFixer won't pad the file or add artificial noise; it keeps the best-quality version and warns you. Use a sharper, higher-resolution original if the form rejects it.`,
              ),
            ],
          },
          {
            id: "wrong-format",
            heading: "Wrong format",
            blocks: [
              p(
                `The form expects ${d.format}. Renaming a PNG or WebP file to .jpg doesn't convert it. ExamPhotoFixer accepts JPG, PNG and WebP and always saves the CCC photo as a real JPG.`,
              ),
            ],
          },
          {
            id: "dpi",
            heading: "DPI or PPI issue",
            blocks: [
              p(
                `If a form reports a DPI problem, the file is missing a DPI value or has one outside ${d.dpi}. The CCC Photo Resizer writes ${chooseOutputDpi(photo.dpi)} DPI into the file. DPI doesn't affect how sharp the photo looks.`,
              ),
            ],
          },
          {
            id: "rotated",
            heading: "Photo appears rotated",
            blocks: [
              p(
                "Phones often store a photo sideways with a note saying how to rotate it, which some upload forms ignore. ExamPhotoFixer applies that rotation so the saved file is the right way up.",
              ),
            ],
          },
          {
            id: "cropped",
            heading: "Photo is cropped incorrectly",
            blocks: [
              p(
                "If the top of the head or the chin is cut off, go back to the crop step and zoom out or drag the photo so your whole face fits inside the frame.",
              ),
            ],
          },
          {
            id: "poor-quality",
            heading: "Image quality is poor",
            blocks: [
              list(
                [
                  "Start from the largest, sharpest original you have — enlarging a tiny photo makes it blurry.",
                ],
                ["Avoid screenshots of photos; they lose detail."],
                ["Blur or low light in the original can't be fixed by resizing."],
              ),
            ],
          },
          {
            id: "checklist",
            heading: "What to check before uploading",
            blocks: [
              list(
                [`Dimensions are exactly ${d.size}.`],
                [`File size is within ${d.kb}.`],
                [`The file is a ${d.format}.`],
                [`DPI is within ${d.dpi}.`],
                [
                  "The photo follows the guideline's notes on background, recency and a clearly visible face.",
                ],
                ["You're uploading the processed file, not the original."],
              ),
              p(NO_GUARANTEE),
            ],
          },
        ],
        faq: [
          {
            question: "Why does my CCC photo upload keep failing?",
            answer: `Usually one of the four technical values is off — dimensions, file size, format or DPI. Check each against ${d.size}, ${d.kb}, ${d.format} and ${d.dpi}.`,
          },
          {
            question: "Can I just rename my PNG to JPG?",
            answer:
              "No. Renaming doesn't change the file's format. Convert it with a tool that saves a real JPG, such as the CCC Photo Resizer.",
          },
        ],
      };
    },
  },
];

const BY_SLUG = new Map(GUIDES.map((guide) => [guide.slug, guide]));

export const GUIDE_CATEGORIES: readonly GuideCategory[] = ["CCC", "Application Help"];

export function listGuides(): readonly Guide[] {
  return GUIDES;
}

export function getGuide(slug: string): Guide | undefined {
  return BY_SLUG.get(slug);
}

export function guidePath(guide: Pick<Guide, "slug">): string {
  return `/guides/${guide.slug}`;
}

export function guidePresets(guide: Guide): ImagePreset[] {
  return guide.presetIds.map(getPreset);
}

export function buildGuide(guide: Guide): GuideBody {
  return guide.build(guidePresets(guide));
}

/** Guides that link to a tool, for "Related guides" on tool pages. */
export function guidesForTool(toolId: ToolId): Guide[] {
  return GUIDES.filter((guide) => guide.toolLinks.some((link) => link.toolId === toolId));
}
