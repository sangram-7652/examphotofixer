/**
 * Deterministic search-intent labels for Search Console queries. Ordered keyword rules only:
 * the same query always gets the same label, and the rule that fired is returned so every
 * label can be audited. No quality judgement, no scoring, no ML.
 *
 * Exam vocabulary is passed in (built from the exam registry by `site-inventory.ts`), so a new
 * exam never needs a change here.
 */

export type SearchIntent =
  | "NAVIGATIONAL"
  | "PROBLEM_INTENT"
  | "EXACT_TOOL_INTENT"
  | "REQUIREMENT_INTENT"
  | "GENERIC_TOOL_INTENT"
  | "INFORMATIONAL";

export const SEARCH_INTENTS: readonly SearchIntent[] = [
  "NAVIGATIONAL",
  "PROBLEM_INTENT",
  "EXACT_TOOL_INTENT",
  "REQUIREMENT_INTENT",
  "GENERIC_TOOL_INTENT",
  "INFORMATIONAL",
];

export type AssetType = "photo" | "signature" | "thumb" | "declaration";

export interface ExamVocabulary {
  id: string;
  status: "active" | "planned";
  /** Lower-case names that identify the exam in a query, e.g. "ccc", "nielit". */
  terms: readonly string[];
}

export interface QuerySpec {
  /** Pixel dimensions mentioned, e.g. 132x170 → { width: 132, height: 170 }. */
  dimensions: { width: number; height: number } | null;
  /** A file size mentioned in KB (MB converted ×1024). */
  kb: number | null;
  mentionsDpi: boolean;
}

export interface IntentResult {
  intent: SearchIntent;
  /** Which rule fired, for auditing. */
  rule: string;
  examId: string | null;
  asset: AssetType | null;
  spec: QuerySpec;
}

const BRAND = /\bexam\s*photo\s*fixer\b|\bexamphotofixer\b/;
const PROBLEM =
  /\btoo\s+(large|big|small|heavy|low)\b|\bnot\s+(upload|uploading|accept|accepted|support|supported|valid|opening)\b|\b(rejected|rejection|invalid|error|failed|fail|failing|problem|issue|exceeds?|exceeded|unable|blurry|blurred)\b|\bcan'?t\s+upload\b/;
const TOOL =
  /\b(resize|resizer|resizing|compress|compressor|compression|convert|converter|reduce|crop|cropper|maker|editor|tool|online|change)\b/;
const REQUIREMENT =
  /\b(size|sizes|dimension|dimensions|format|requirement|requirements|specification|specifications|pixel|pixels|rules|guidelines?|kb|dpi|resolution)\b/;
const IMAGE = /\b(image|images|photo|photos|picture|pic|jpg|jpeg|png|webp|signature|sign|thumb)\b/;
const ASSETS: readonly [AssetType, RegExp][] = [
  ["signature", /\b(signature|sign|sig)\b/],
  ["thumb", /\b(thumb|thumbprint|lti)\b/],
  ["declaration", /\bdeclaration\b/],
  ["photo", /\b(photo|photograph|photos|picture|pic|passport)\b/],
];

export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSpec(normalized: string): QuerySpec {
  const dims = /\b(\d{2,4})\s*(?:x|×|\*|by)\s*(\d{2,4})\b/.exec(normalized);
  const size = /\b(\d{1,4}(?:\.\d+)?)\s*(kb|mb)\b/.exec(normalized);
  return {
    dimensions: dims ? { width: Number(dims[1]), height: Number(dims[2]) } : null,
    kb: size ? Number(size[1]) * (size[2] === "mb" ? 1024 : 1) : null,
    mentionsDpi: /\bdpi\b/.test(normalized),
  };
}

function findExam(normalized: string, exams: readonly ExamVocabulary[]): ExamVocabulary | null {
  for (const exam of exams) {
    for (const term of exam.terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`).test(normalized)) return exam;
    }
  }
  return null;
}

export function classifyQuery(query: string, exams: readonly ExamVocabulary[]): IntentResult {
  const q = normalizeQuery(query);
  const spec = extractSpec(q);
  const exam = findExam(q, exams);
  const asset = ASSETS.find(([, pattern]) => pattern.test(q))?.[0] ?? null;
  const hasSpec = spec.dimensions !== null || spec.kb !== null;
  const base = { examId: exam?.id ?? null, asset, spec };

  if (BRAND.test(q)) return { intent: "NAVIGATIONAL", rule: "brand", ...base };
  if (PROBLEM.test(q)) return { intent: "PROBLEM_INTENT", rule: "problem-words", ...base };
  if (exam && (TOOL.test(q) || hasSpec)) {
    return { intent: "EXACT_TOOL_INTENT", rule: "exam+tool-or-spec", ...base };
  }
  if (exam && (REQUIREMENT.test(q) || asset)) {
    return { intent: "REQUIREMENT_INTENT", rule: "exam+requirement", ...base };
  }
  if (TOOL.test(q) && (IMAGE.test(q) || hasSpec)) {
    return { intent: "GENERIC_TOOL_INTENT", rule: "tool+image-or-spec", ...base };
  }
  if (hasSpec && IMAGE.test(q)) {
    return { intent: "GENERIC_TOOL_INTENT", rule: "spec+image", ...base };
  }
  if (asset && REQUIREMENT.test(q)) {
    // e.g. "neet photo size": a requirement question for an exam not in the registry.
    return { intent: "REQUIREMENT_INTENT", rule: "asset+requirement (exam unknown)", ...base };
  }
  return { intent: "INFORMATIONAL", rule: "fallback", ...base };
}
