import type { ExamId } from "@/lib/presets/types";

export type ToolKind = "preset" | "pack" | "generic-resize" | "generic-compress";

export type ToolId =
  "ccc-photo" | "ccc-signature" | "ccc-thumb" | "ccc-pack" | "image-resizer" | "image-compressor";

export interface ToolDefinition {
  id: ToolId;
  /** `live` tools render the interactive tool; others show a placeholder. */
  status: "live" | "coming-soon";
  /** URL path, e.g. "/ccc-photo-resizer". Must match a route in src/app. */
  path: string;
  kind: ToolKind;
  exam: ExamId | null;
  /** Presets this tool produces files for, in display order. */
  presetIds: readonly string[];
  name: string;
  h1: string;
  /** Used for <title>; the site name is appended by the root layout. */
  metaTitle: string;
  metaDescription: string;
  summary: string;
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: "ccc-photo",
    path: "/ccc-photo-resizer",
    status: "live",
    kind: "preset",
    exam: "ccc",
    presetIds: ["ccc-photo"],
    name: "CCC Photo Resizer",
    h1: "CCC Photo Resizer",
    metaTitle: "CCC Photo Resizer – Resize Photo for NIELIT CCC Form",
    metaDescription:
      "Resize and compress your photo to the CCC upload size. Crop, resize, set DPI and check the file before you upload — in your browser.",
    summary: "Crop, resize and compress your photo for the CCC application form.",
  },
  {
    id: "ccc-signature",
    path: "/ccc-signature-resizer",
    status: "live",
    kind: "preset",
    exam: "ccc",
    presetIds: ["ccc-signature"],
    name: "CCC Signature Resizer",
    h1: "CCC Signature Resizer",
    metaTitle: "CCC Signature Resizer – Resize Signature for NIELIT CCC Form",
    metaDescription:
      "Resize your signature to the CCC upload size, file size and DPI, check it against the NIELIT guidelines and download a ready JPG — processed in your browser.",
    summary: "Resize and compress your signature for the CCC application form.",
  },
  {
    id: "ccc-thumb",
    path: "/ccc-thumb-impression-resizer",
    status: "live",
    kind: "preset",
    exam: "ccc",
    presetIds: ["ccc-left-thumb"],
    name: "CCC Left Thumb Impression Resizer",
    h1: "CCC Left Thumb Impression Resizer",
    metaTitle: "CCC Thumb Impression Resizer – Left Thumb Image for CCC Form",
    metaDescription:
      "Resize your left thumb impression (LTI) to the CCC upload size, file size and DPI, check it against the NIELIT guidelines and download a ready JPG — processed in your browser.",
    summary: "Resize and compress your left thumb impression for the CCC form.",
  },
  {
    id: "ccc-pack",
    path: "/ccc-complete-pack",
    status: "live",
    kind: "pack",
    exam: "ccc",
    presetIds: ["ccc-photo", "ccc-signature", "ccc-left-thumb"],
    name: "CCC Complete Pack",
    h1: "CCC Complete Pack: Photo, Signature & Left Thumb Impression",
    metaTitle: "CCC Complete Pack – Resize Photo, Signature & Thumb Impression",
    metaDescription:
      "Prepare all three CCC application images — photo, signature and left thumb impression — on one page, check each against the requirements and download them together as a ZIP. Processed in your browser.",
    summary: "Prepare the CCC photo, signature and left thumb impression together.",
  },
  {
    id: "image-resizer",
    path: "/image-resizer",
    status: "live",
    kind: "generic-resize",
    exam: null,
    presetIds: [],
    name: "Image Resizer",
    h1: "Image Resizer",
    metaTitle: "Image Resizer – Resize JPG, PNG & WebP to Custom Dimensions",
    metaDescription:
      "Resize JPG, PNG or WebP images to exact pixel dimensions online. Crop or fit without stretching, choose the format and quality, and download — without uploading your image.",
    summary: "Resize JPG, PNG or WebP to custom dimensions — crop or fit, never stretched.",
  },
  {
    id: "image-compressor",
    path: "/image-compressor",
    status: "live",
    kind: "generic-compress",
    exam: null,
    presetIds: [],
    name: "Image Compressor",
    h1: "Image Compressor",
    metaTitle: "Image Compressor – Compress JPG, PNG & WebP to 100 KB, 500 KB or Less",
    metaDescription:
      "Compress an image under a maximum file size such as 100 KB, 200 KB or 500 KB. Keeps the dimensions, uses the best quality that fits, and checks the real file size — in your browser.",
    summary: "Reduce an image's file size under a maximum like 100 KB or 500 KB.",
  },
];

const TOOLS_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function getTool(id: ToolId): ToolDefinition {
  const tool = TOOLS_BY_ID.get(id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
}

export function toolsForExam(exam: ExamId): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.exam === exam);
}

export function genericTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.exam === null);
}
