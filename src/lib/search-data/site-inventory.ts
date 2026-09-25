/**
 * What the site currently offers, derived from the registries (never typed by hand): which
 * path is a tool or guide, which exam and asset it serves, and the verified requirement
 * values per exam asset. The opportunity engine compares search demand against this.
 */

import { guidePath, listGuides } from "@/content/guides";
import { listExams, listPresets } from "@/lib/presets";
import { TOOLS } from "@/lib/tools/registry";
import type { AssetType, ExamVocabulary } from "./intent";

export type PageKind = "home" | "tools_index" | "guides_index" | "tool" | "guide" | "other";

export interface InventoryPage {
  path: string;
  kind: PageKind;
  examId: string | null;
  toolId: string | null;
  guideSlug: string | null;
  /** Guide category, e.g. "Application Help" for problem guides. */
  guideCategory: string | null;
}

export interface VerifiedRequirement {
  examId: string;
  asset: AssetType;
  presetId: string;
  width: number;
  height: number;
  kb: { min: number; max: number };
  sourceId: string;
}

export interface SiteInventory {
  exams: ExamVocabulary[];
  pages: InventoryPage[];
  /** Live tools per exam id (generic tools under "generic"). */
  liveToolsByExam: Record<string, string[]>;
  requirements: VerifiedRequirement[];
  /** Exams that have a problem-solving ("Application Help") guide. */
  examsWithProblemGuide: string[];
}

function assetOf(documentType: string): AssetType {
  if (documentType.includes("thumb")) return "thumb";
  if (documentType.includes("signature")) return "signature";
  if (documentType.includes("declaration")) return "declaration";
  return "photo";
}

export function buildSiteInventory(): SiteInventory {
  const exams: ExamVocabulary[] = listExams().map((exam) => ({
    id: exam.id,
    status: exam.status,
    terms: [
      ...new Set(
        [exam.id, exam.shortName, exam.fullName, exam.conductingBody].map((t) => t.toLowerCase()),
      ),
    ],
  }));

  const pages: InventoryPage[] = [
    { path: "/", kind: "home", examId: null, toolId: null, guideSlug: null, guideCategory: null },
    {
      path: "/tools",
      kind: "tools_index",
      examId: null,
      toolId: null,
      guideSlug: null,
      guideCategory: null,
    },
    {
      path: "/guides",
      kind: "guides_index",
      examId: null,
      toolId: null,
      guideSlug: null,
      guideCategory: null,
    },
  ];
  const liveToolsByExam: Record<string, string[]> = {};
  for (const tool of TOOLS) {
    if (tool.status !== "live") continue;
    pages.push({
      path: tool.path,
      kind: "tool",
      examId: tool.exam,
      toolId: tool.id,
      guideSlug: null,
      guideCategory: null,
    });
    const key = tool.exam ?? "generic";
    (liveToolsByExam[key] ??= []).push(tool.id);
  }

  const examsWithProblemGuide = new Set<string>();
  const presetsById = new Map(listPresets().map((preset) => [preset.id, preset]));
  for (const guide of listGuides()) {
    const examIds = [
      ...new Set(guide.presetIds.map((id) => presetsById.get(id)?.exam).filter(Boolean)),
    ] as string[];
    const examId = examIds.length === 1 ? examIds[0] : null;
    pages.push({
      path: guidePath(guide),
      kind: "guide",
      examId,
      toolId: null,
      guideSlug: guide.slug,
      guideCategory: guide.category,
    });
    if (guide.category === "Application Help") {
      for (const id of examIds) examsWithProblemGuide.add(id);
    }
  }

  const requirements: VerifiedRequirement[] = listPresets()
    .filter((preset) => preset.source.status === "verified")
    .map((preset) => ({
      examId: preset.exam,
      asset: assetOf(preset.documentType),
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      kb: { min: preset.fileSizeKB.min, max: preset.fileSizeKB.max },
      sourceId: preset.source.id,
    }));

  return {
    exams,
    pages,
    liveToolsByExam,
    requirements,
    examsWithProblemGuide: [...examsWithProblemGuide],
  };
}

/** Maps a Search Console page URL (any host) to an inventory page by pathname. */
export function findPage(inventory: SiteInventory, url: string): InventoryPage | null {
  let path: string;
  try {
    path = new URL(url, "https://placeholder.invalid").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
  return inventory.pages.find((page) => page.path === path) ?? null;
}
