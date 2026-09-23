import type { ExamId } from "@/lib/presets/types";

export type ToolKind = "preset" | "pack" | "generic-resize" | "generic-compress";

export type ToolId =
  "ccc-photo" | "ccc-signature" | "ccc-thumb" | "ccc-pack" | "image-resizer" | "image-compressor";

export interface ToolDefinition {
  id: ToolId;
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
    kind: "preset",
    exam: "ccc",
    presetIds: ["ccc-signature"],
    name: "CCC Signature Resizer",
    h1: "CCC Signature Resizer",
    metaTitle: "CCC Signature Resizer – Resize Signature for NIELIT CCC Form",
    metaDescription:
      "Resize and compress your signature image to the CCC upload size and check it before you upload — processed in your browser.",
    summary: "Resize and compress your signature for the CCC application form.",
  },
  {
    id: "ccc-thumb",
    path: "/ccc-thumb-impression-resizer",
    kind: "preset",
    exam: "ccc",
    presetIds: ["ccc-left-thumb"],
    name: "CCC Left Thumb Impression Resizer",
    h1: "CCC Left Thumb Impression Resizer",
    metaTitle: "CCC Thumb Impression Resizer – Left Thumb Image for CCC Form",
    metaDescription:
      "Resize and compress your left thumb impression image to the CCC upload size and check it before you upload — processed in your browser.",
    summary: "Resize and compress your left thumb impression for the CCC form.",
  },
  {
    id: "ccc-pack",
    path: "/ccc-image-resizer",
    kind: "pack",
    exam: "ccc",
    presetIds: ["ccc-photo", "ccc-signature", "ccc-left-thumb"],
    name: "CCC Complete Pack",
    h1: "CCC Image Resizer – Photo, Signature & Thumb Impression",
    metaTitle: "CCC Image Resizer – Photo, Signature & Thumb in One Place",
    metaDescription:
      "Prepare all three CCC uploads — photo, signature and left thumb impression — with the right size, file size and DPI. Processed in your browser.",
    summary: "Prepare the CCC photo, signature and left thumb impression together.",
  },
  {
    id: "image-resizer",
    path: "/image-resizer",
    kind: "generic-resize",
    exam: null,
    presetIds: [],
    name: "Image Resizer",
    h1: "Image Resizer",
    metaTitle: "Image Resizer – Resize to Exact Pixels Online",
    metaDescription:
      "Resize any photo to exact pixel dimensions without stretching it. Crop to shape, resize and download — processed in your browser.",
    summary: "Resize any image to exact pixel dimensions without stretching.",
  },
  {
    id: "image-compressor",
    path: "/image-compressor",
    kind: "generic-compress",
    exam: null,
    presetIds: [],
    name: "Image Compressor",
    h1: "Image Compressor",
    metaTitle: "Image Compressor – Reduce Image Size in KB Online",
    metaDescription:
      "Reduce your image file size to a target KB while keeping it readable. Processed in your browser — your file is not uploaded.",
    summary: "Reduce an image to a target file size in KB.",
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
