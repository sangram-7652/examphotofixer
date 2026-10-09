/**
 * Editorial content for tool pages. Requirement numbers are always read from
 * the preset — never typed into copy — so content can't drift from the data.
 */

import { chooseOutputDpi } from "@/lib/image/dpi";
import { describePreset } from "@/lib/presets/describe";
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
  /** Optional contextual link shown near the tool. */
  callout?: { text: string; linkText: string; href: string };
}

const describe = describePreset;

function cccPhotoContent(preset: ImagePreset): ToolContent {
  const d = describe(preset);
  return {
    intro: `Resize your photo to the CCC upload requirements — ${d.size}, ${d.kb}, ${d.format} — and check it before you upload. Your photo is processed on your device and never uploaded to our servers.`,
    howItWorks: [
      "Choose your photo — for example a scan or digital copy of a recent passport-style photo. Check the photo guidelines further down this page.",
      `Drag and zoom so your face fills the frame. The frame already has the required ${preset.width}:${preset.height} shape, so your photo is cropped, never stretched.`,
      `Tap “Process photo”. We fix the orientation, resize to exactly ${d.size}, compress toward ${d.kb} at the best possible quality, and set the DPI.`,
      "Check the results list, then download the JPG and upload it to the CCC form.",
    ],
    commonProblems: [
      {
        title: "“Invalid dimensions” on the form",
        body: `The form checks exact pixel sizes. Phone photos are usually thousands of pixels wide. This tool outputs exactly ${d.size}.`,
      },
      {
        title: "“File size too large”",
        body: `Camera photos are often several megabytes. The tool compresses toward ${d.kb} at the best possible quality and checks the final file against that range.`,
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
      `Tap “Process ${short}”. We resize to exactly ${d.size}, compress toward ${d.kb} at the best possible quality, and set the DPI.`,
      "Check the results list, then download the JPG and upload it to the CCC form.",
    ],
    commonProblems: [
      {
        title: `${kind === "signature" ? "Signature" : "Thumb impression"} too small in the frame`,
        body: `Zoom in so the ${short} fills most of the frame. Extra blank paper around it is kept in the image and makes it harder to read.`,
      },
      kind === "signature"
        ? {
            title: "Ink looks faint or patchy after resizing",
            body: "Resizing can't restore ink that didn't transfer evenly onto the paper. Sign again with a fresh pen stroke in good, even light, and avoid signing over a fold or a textured surface.",
          }
        : {
            title: "Impression looks smudged or incomplete",
            body: "Resizing can't fix a thumb impression that smudged or didn't fully touch the paper. Clean your thumb, apply an even, thin layer of ink and press down firmly without sliding.",
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

function imageResizerContent(): ToolContent {
  return {
    intro:
      "Resize JPG, PNG or WebP images to the exact width and height you need. Crop to the new shape or fit the whole image inside it — nothing is stretched, and your image never leaves your device.",
    howItWorks: [
      "Choose an image (JPG, PNG or WebP). You'll see its current width, height, file size and format.",
      "Enter the new width and height. With “Lock aspect ratio” on, changing one updates the other.",
      "Choose “Crop to exact dimensions” and position the frame, or “Fit inside dimensions” to keep the whole image.",
      "Pick the output format (and quality for JPG/WebP), press “Resize Image”, check the result and download it.",
    ],
    commonProblems: [
      {
        title: "Stretched or squashed images",
        body: "Changing width and height independently usually distorts a picture. Here, crop trims the edges to the new shape and fit scales the whole image, so proportions are always kept.",
      },
      {
        title: "Transparent background turns black or white",
        body: "JPG can't store transparency. Keep PNG or WebP to preserve it; if you choose JPG, transparent areas are filled with white and the tool tells you before you resize.",
      },
      {
        title: "Uploading private photos to a website",
        body: "Resizing happens in your browser, so the image is never uploaded to a server.",
      },
    ],
    faq: [
      {
        question: "How do I resize an image?",
        answer:
          "Choose your image, enter the width and height in pixels, pick crop or fit, and press “Resize Image”. Check the result, then download it.",
      },
      {
        question: "Can I resize JPG, PNG and WebP?",
        answer:
          "Yes. You can open JPG, PNG and WebP images and save the result as JPG, PNG or WebP. WebP output is offered when your browser supports saving it.",
      },
      {
        question: "What is crop vs fit?",
        answer:
          "Crop makes the image exactly the size you enter and trims whatever falls outside the frame. Fit keeps the whole image and scales it to fit inside the size you enter, so one side can be smaller than requested. Neither option stretches the image or adds a background.",
      },
      {
        question: "Can I lock the aspect ratio?",
        answer:
          "Yes. With “Lock aspect ratio” on, changing the width updates the height (and the other way round) using the original proportions. Turn it off to enter both sides freely.",
      },
      {
        question: "Does the image get uploaded?",
        answer:
          "No. The image is processed inside your browser and is never uploaded to our servers. Location and camera details (EXIF) are not included in the resized file.",
      },
    ],
    callout: {
      text: "Preparing an exam image?",
      linkText: "Try the CCC image tools",
      href: "/ccc-complete-pack",
    },
  };
}

function imageCompressorContent(): ToolContent {
  return {
    intro:
      "Compress a JPG, PNG or WebP image under a maximum file size such as 100 KB, 200 KB or 500 KB. The tool keeps the dimensions, uses the best quality that fits, and checks the real size of the file you download — all in your browser.",
    howItWorks: [
      "Choose an image (JPG, PNG or WebP).",
      "Pick a maximum file size — 100 KB, 200 KB, 500 KB, 1 MB — or enter your own. 1 KB means 1024 bytes.",
      "Choose JPG or WebP output and press “Compress Image”. The tool finds the highest quality whose actual file size fits your limit.",
      "Compare before and after, then download. If the limit can't be reached, you'll be told instead of getting an oversized file.",
    ],
    commonProblems: [
      {
        title: "“File too large” on an upload form",
        body: "Set the form's limit as the maximum file size. The result is checked against that limit using its actual size before you can download it.",
      },
      {
        title: "Limit can't be reached",
        body: "Very large or very detailed photos may not fit a small limit even at the lowest quality we allow. Reduce the dimensions with the Image Resizer, then compress again.",
      },
      {
        title: "Compressed file is bigger than the original",
        body: "Some images are already heavily compressed. When no smaller version is possible, the tool says so and suggests keeping your original.",
      },
    ],
    faq: [
      {
        question: "How do I compress an image?",
        answer:
          "Choose your image, pick a maximum file size, choose JPG or WebP and press “Compress Image”. Compare the sizes and download the result.",
      },
      {
        question: "Can I compress an image to 100 KB?",
        answer:
          "Choose the 100 KB maximum. Many photos fit; very large or detailed ones may not reach 100 KB without reducing their dimensions. If the limit can't be reached, the tool tells you and doesn't offer an oversized file.",
      },
      {
        question: "Can I compress an image to 500 KB?",
        answer:
          "Yes — choose the 500 KB maximum. The downloaded file is at most 500 × 1024 = 512,000 bytes, checked on the actual file.",
      },
      {
        question: "Does compression reduce quality?",
        answer:
          "Smaller files need stronger compression, which can reduce fine detail. The tool uses the highest quality that fits your limit, so the image looks as good as possible at that size.",
      },
      {
        question: "Are image dimensions preserved?",
        answer:
          "Yes, the width and height stay the same. Only images above the browser's processing limit (about 16.8 megapixels) are scaled down, and the tool tells you when that happens.",
      },
      {
        question: "Is my image uploaded?",
        answer:
          "No. Compression happens inside your browser and the image is never uploaded to our servers. Location and camera details (EXIF) are removed from the result.",
      },
    ],
    callout: {
      text: "Need a specific CCC file size?",
      linkText: "Use the CCC Photo Resizer",
      href: "/ccc-photo-resizer",
    },
  };
}

function ibpsPhotoContent(preset: ImagePreset): ToolContent {
  const d = describe(preset);
  const citation = sourceCitation(preset.source);
  return {
    intro: `Resize your photo to the requirements in the IBPS CRP RRBs-XV scanning guidelines — ${d.size}, ${d.kb}, ${d.format}, ${d.dpi} — and check it before you upload. Your photo is processed on your device and never uploaded to our servers.`,
    howItWorks: [
      "Choose a recent passport-style colour photo (see the guideline notes further down this page).",
      `Drag and zoom so your face fills the frame. The frame has the ${preset.width}:${preset.height} shape, so your photo is cropped, never stretched.`,
      `Tap “Process photo”. We fix the orientation, resize to the preferred ${d.size}, compress toward ${d.kb} at the best possible quality, and write ${chooseOutputDpi(preset.dpi)} DPI into the file.`,
      "Check the results list, download the JPG and upload it in the photograph field of the IBPS application.",
    ],
    commonProblems: [
      {
        title: "Photo rejected as too large",
        body: `Phone photos are usually several megabytes. The tool compresses toward ${d.kb} at the best possible quality and checks the final file against that range.`,
      },
      {
        title: "Two photo steps in the application",
        body: "IBPS asks for this uploaded photograph and, separately, a photo captured live with a webcam or phone during the application. This tool prepares the uploaded photograph only.",
      },
      {
        title: "Face squashed after resizing",
        body: "Resizing without cropping distorts the face. The tool crops to the required shape first, so proportions stay natural.",
      },
    ],
    faq: [
      {
        question: "What size should the IBPS photo be?",
        answer: `According to the ${citation}: ${d.size} (width × height, stated as preferred), between ${d.kb}, in ${d.format} format. The scanning instructions ask for ${d.dpi}. Check the notification for your recruitment before you upload.`,
      },
      {
        question: "Does this replace the live photo capture?",
        answer:
          "No. IBPS also asks you to capture a photo with a webcam or mobile phone during the application. That step happens on the IBPS website; this tool only prepares the photograph you upload.",
      },
      {
        question: "Is my photo uploaded to your server?",
        answer:
          "No. Cropping, resizing and compression all happen inside your browser. The photo never leaves your device.",
      },
      {
        question: "Is ExamPhotoFixer affiliated with IBPS?",
        answer:
          "No. ExamPhotoFixer is an independent tool and is not affiliated with IBPS or any bank or exam body.",
      },
    ],
  };
}

/** IBPS signature, left thumb impression and handwritten declaration share one flow. */
function ibpsDocumentContent(
  preset: ImagePreset,
  kind: "signature" | "thumb" | "declaration",
): ToolContent {
  const d = describe(preset);
  const citation = sourceCitation(preset.source);
  const noun = {
    signature: "signature",
    thumb: "left thumb impression",
    declaration: "handwritten declaration",
  }[kind];
  const short = { signature: "signature", thumb: "thumb impression", declaration: "declaration" }[
    kind
  ];
  const guidance = preset.guidance ?? [];
  const cannotCheck = {
    signature:
      "whether you signed in black ink, in capital letters, or whether it is your own signature",
    thumb: "whether the impression is clear or which finger was used",
    declaration:
      "the handwriting, the language, capital letters, or whether the text matches the declaration IBPS asks for",
  }[kind];
  return {
    intro: `Resize the image of your ${noun} to the requirements in the IBPS CRP RRBs-XV scanning guidelines — ${d.size}, ${d.kb}, ${d.format}, ${d.dpi} — and check it before you upload. The image is processed on your device and never uploaded to our servers.`,
    howItWorks: [
      `Prepare your ${noun} as the notification describes (see “The same guidelines also ask” below), then scan it or take a clear, well-lit picture of it.`,
      `Choose the image and drag or zoom so the ${short} fills the frame. The frame has the ${preset.width}:${preset.height} shape, so nothing is stretched.`,
      `Tap “Process ${short}”. We resize to the preferred ${d.size}, compress toward ${d.kb} at the best possible quality, and write ${chooseOutputDpi(preset.dpi)} DPI into the file.`,
      `Check the results list, download the JPG and upload it in the ${noun} field of the IBPS application.`,
    ],
    commonProblems: [
      {
        title: `${short.charAt(0).toUpperCase()}${short.slice(1)} too small in the frame`,
        body: `Zoom in so the ${short} fills most of the frame. Blank paper around it stays in the image and makes it harder to read.`,
      },
      {
        title: `File is below ${preset.fileSizeKB.min} KB`,
        body: `Dark ink on plain white paper compresses to small files. We keep the highest-quality version and tell you if it is below ${preset.fileSizeKB.min} KB, instead of adding artificial data. A sharper scan or photo usually helps.`,
      },
      {
        title: "What the tool can't check",
        body: `The tool checks size, file size, format and DPI. It can't check ${cannotCheck}. Follow the notification's instructions for those.`,
      },
    ],
    faq: [
      {
        question: `What size should the IBPS ${noun} be?`,
        answer: `According to the ${citation}: ${d.size} (width × height, stated as preferred), between ${d.kb}, in ${d.format} format. The scanning instructions ask for ${d.dpi}. Check the notification for your recruitment before you upload.`,
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
        question: "Is my image uploaded to your server?",
        answer: "No. Everything happens inside your browser; the image never leaves your device.",
      },
      {
        question: "Is ExamPhotoFixer affiliated with IBPS?",
        answer:
          "No. ExamPhotoFixer is an independent tool and is not affiliated with IBPS or any bank or exam body.",
      },
    ],
  };
}

function ibpsPackContent(presets: ImagePreset[]): ToolContent {
  const list = presets
    .map((preset) => {
      const d = describe(preset);
      return `${preset.label.replace(/^IBPS /, "")}: ${d.size}, ${d.kb}`;
    })
    .join("; ");
  const first = describe(presets[0]);
  const signature = presets[1];
  const thumb = presets[2];
  const declaration = presets[3];
  return {
    intro: `Prepare all four IBPS CRP RRBs-XV application images on one page — photo, signature, left thumb impression and handwritten declaration — check each against the requirements and download them together as a ZIP. Everything is processed on your device.`,
    howItWorks: [
      "Work through the four steps on this page: photo, signature, left thumb impression, then handwritten declaration.",
      "For each file: choose the image, adjust the crop, and process it. Each file is checked against its own requirements.",
      "The pack status shows which files are ready, which have a warning and which still need attention.",
      "When all four are processed, download them together as one ZIP — or download each file on its own.",
    ],
    commonProblems: [
      {
        title: "Mixing up the four sizes",
        body: "Each IBPS image has its own dimensions and file-size range. Each step here uses the right requirements automatically.",
      },
      {
        title: "The live photo and the certificates",
        body: "IBPS also asks for a photo captured live during the application and, where applicable, certificates as PDF. Those happen on the IBPS website; this pack prepares the four images.",
      },
    ],
    faq: [
      {
        question: "What are the IBPS application image requirements?",
        answer: `According to the ${sourceCitation(presets[0].source)}: ${list}. All must be ${first.format}, and the scanning instructions ask for ${first.dpi}.`,
      },
      ...(signature.guidance && signature.guidance.length > 0
        ? [
            {
              question: "How should I prepare the signature?",
              answer: `${signature.guidance.join(" ")} This tool fixes the size, file size, format and DPI; it can't change how the signature was made.`,
            },
          ]
        : []),
      ...(thumb.guidance && thumb.guidance.length > 0
        ? [
            {
              question: "How should I prepare the left thumb impression?",
              answer: `${thumb.guidance.join(" ")} This tool fixes the size, file size, format and DPI; it can't change how the thumb impression was made.`,
            },
          ]
        : []),
      ...(declaration.guidance && declaration.guidance.length > 0
        ? [
            {
              question: "How should I prepare the handwritten declaration?",
              answer: `${declaration.guidance.join(" ")} This tool fixes the size, file size, format and DPI; it can't change how the declaration was made.`,
            },
          ]
        : []),
      {
        question: "Does this pack replace the mandatory live photo capture?",
        answer:
          "No. IBPS also asks you to capture a photo with a webcam or mobile phone during the application, and in some recruitments to upload certificates as PDF. Those steps happen on the IBPS website; this pack only prepares the four uploaded images.",
      },
      {
        question: "What is in the ZIP file?",
        answer:
          "Exactly the four processed JPG files shown on this page, named for each document. The ZIP is created in your browser; nothing is uploaded.",
      },
      {
        question: "Can I download the pack if one file is below the minimum size?",
        answer:
          "Yes. We keep the highest-quality version instead of adding artificial data, and show a warning. The application website may still enforce its own minimum-size check.",
      },
      {
        question: "Is ExamPhotoFixer affiliated with IBPS?",
        answer:
          "No. ExamPhotoFixer is an independent tool and is not affiliated with IBPS or any bank or exam body.",
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
  "ibps-photo": (presets) => (presets.length === 1 ? ibpsPhotoContent(presets[0]) : null),
  "ibps-signature": (presets) =>
    presets.length === 1 ? ibpsDocumentContent(presets[0], "signature") : null,
  "ibps-thumb": (presets) =>
    presets.length === 1 ? ibpsDocumentContent(presets[0], "thumb") : null,
  "ibps-declaration": (presets) =>
    presets.length === 1 ? ibpsDocumentContent(presets[0], "declaration") : null,
  "ibps-pack": (presets) => (presets.length > 1 ? ibpsPackContent(presets) : null),
  "image-resizer": () => imageResizerContent(),
  "image-compressor": () => imageCompressorContent(),
};

export function getToolContent(tool: ToolDefinition, presets: ImagePreset[]): ToolContent | null {
  return CONTENT[tool.id]?.(presets) ?? null;
}
