/**
 * Content opportunity model (docs/GROWTH_PLAN.md). Turns Search Console query (+ page) rows into
 * reviewable candidates with an explicit opportunity type, the rule that produced it and its
 * evidence. It only proposes; nothing is published automatically.
 *
 * Hard rules encoded here:
 * - Below the evidence threshold → NO_ACTION (small numbers are noise).
 * - Search demand is never a requirement: a query that mentions numbers different from a
 *   verified preset yields UPDATE_REQUIREMENT = "re-check the official source", never "change
 *   the preset". Exams without verified presets yield CREATE_TOOL with verification required.
 * - Navigational (brand) queries → NO_ACTION.
 */

import type { Aggregate, SearchRow } from "./gsc";
import { classifyQuery, type IntentResult, type SearchIntent } from "./intent";
import { findPage, type InventoryPage, type SiteInventory } from "./site-inventory";

export type OpportunityType =
  | "OPTIMIZE_EXISTING_PAGE"
  | "CREATE_GUIDE"
  | "CREATE_TOOL"
  | "UPDATE_REQUIREMENT"
  | "ADD_INTERNAL_LINK"
  | "NO_ACTION";

export type DataClass = "REAL" | "TEST_FIXTURE";

export interface OpportunityOptions {
  /** Minimum impressions before any action is proposed. */
  minImpressions: number;
  /** CTR below this (0–1) at a good position counts as low. */
  lowCtr: number;
  /** Average position at or better than this counts as "ranking". */
  goodPosition: number;
}

export const DEFAULT_OPPORTUNITY_OPTIONS: OpportunityOptions = {
  minImpressions: 100,
  lowCtr: 0.02,
  goodPosition: 10,
};

export interface Opportunity {
  query: string;
  intent: SearchIntent;
  intentRule: string;
  examId: string | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
  /** The page Search Console showed most for this query (by impressions), if known. */
  page: string | null;
  existingTool: string | null;
  existingGuide: string | null;
  type: OpportunityType;
  /** Why this type was chosen. */
  reason: string;
  /** True when official requirements must be verified first (P12 process). */
  verificationRequired: boolean;
  evidence: { source: string; dataClass: DataClass };
}

interface QueryEvidence {
  query: string;
  total: Aggregate;
  topPage: string | null;
}

function groupByQuery(rows: readonly SearchRow[]): QueryEvidence[] {
  type Group = { rows: SearchRow[]; pages: Map<string, number> };
  const byQuery = new Map<string, Group>();
  for (const row of rows) {
    if (row.query === undefined || row.query === "") continue;
    const entry: Group = byQuery.get(row.query) ?? { rows: [], pages: new Map<string, number>() };
    entry.rows.push(row);
    if (row.page) entry.pages.set(row.page, (entry.pages.get(row.page) ?? 0) + row.impressions);
    byQuery.set(row.query, entry);
  }
  return [...byQuery].map(([query, { rows: group, pages }]) => {
    let clicks = 0;
    let impressions = 0;
    let weighted = 0;
    let known = 0;
    for (const row of group) {
      clicks += row.clicks;
      impressions += row.impressions;
      if (row.position !== null) {
        weighted += row.position * row.impressions;
        known += row.impressions;
      }
    }
    const topPage = [...pages].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    return {
      query,
      topPage: topPage ?? null,
      total: {
        key: query,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : null,
        position: known > 0 ? weighted / known : null,
      },
    };
  });
}

function decide(
  intent: IntentResult,
  evidence: QueryEvidence,
  page: InventoryPage | null,
  inventory: SiteInventory,
  options: OpportunityOptions,
): { type: OpportunityType; reason: string; verificationRequired: boolean } {
  const { total } = evidence;
  const none = (reason: string) => ({
    type: "NO_ACTION" as const,
    reason,
    verificationRequired: false,
  });

  if (intent.intent === "NAVIGATIONAL") return none("brand query");
  if (total.impressions < options.minImpressions) {
    return none(
      `below evidence threshold (${total.impressions} < ${options.minImpressions} impressions)`,
    );
  }

  const exam = intent.examId ? inventory.exams.find((e) => e.id === intent.examId) : undefined;
  const examSpecific =
    intent.intent === "EXACT_TOOL_INTENT" || intent.intent === "REQUIREMENT_INTENT";

  if (examSpecific && !exam) {
    return {
      type: "CREATE_TOOL",
      reason:
        "requirement demand for an exam not in the registry: identify the exam and its official source first",
      verificationRequired: true,
    };
  }
  if (exam && exam.status === "planned") {
    return {
      type: "CREATE_TOOL",
      reason: `demand for planned exam "${exam.id}": no verified requirements, so no tool until verified (P12)`,
      verificationRequired: true,
    };
  }
  if (exam && intent.asset) {
    const requirement = inventory.requirements.find(
      (r) => r.examId === exam.id && r.asset === intent.asset,
    );
    if (!requirement) {
      return {
        type: "CREATE_TOOL",
        reason: `no verified ${intent.asset} requirement for "${exam.id}": verify the official source first (P12)`,
        verificationRequired: true,
      };
    }
    const { dimensions, kb } = intent.spec;
    const dimsDiffer =
      dimensions !== null &&
      !(
        (dimensions.width === requirement.width && dimensions.height === requirement.height) ||
        (dimensions.width === requirement.height && dimensions.height === requirement.width)
      );
    const kbOutside = kb !== null && (kb < requirement.kb.min || kb > requirement.kb.max);
    if (dimsDiffer || kbOutside) {
      return {
        type: "UPDATE_REQUIREMENT",
        reason:
          `query mentions ${dimsDiffer ? `${dimensions!.width}×${dimensions!.height}` : `${kb} KB`}, ` +
          `unlike verified ${requirement.presetId} (${requirement.width}×${requirement.height}, ` +
          `${requirement.kb.min}–${requirement.kb.max} KB): re-check the official source for a newer ` +
          "notification; do not change the preset from search data",
        verificationRequired: true,
      };
    }
  }
  if (
    intent.intent === "PROBLEM_INTENT" &&
    exam &&
    !inventory.examsWithProblemGuide.includes(exam.id)
  ) {
    return {
      type: "CREATE_GUIDE",
      reason: `problem query for "${exam.id}" and no upload-problems guide for that exam`,
      verificationRequired: false,
    };
  }
  if (intent.intent === "EXACT_TOOL_INTENT" && page?.kind === "guide") {
    return {
      type: "ADD_INTERNAL_LINK",
      reason:
        "tool-intent query lands on a guide: make the guide's tool link prominent near the top",
      verificationRequired: false,
    };
  }
  const ranking = total.position !== null && total.position <= options.goodPosition;
  if (ranking && total.ctr !== null && total.ctr < options.lowCtr && page) {
    return {
      type: "OPTIMIZE_EXISTING_PAGE",
      reason: `position ${total.position!.toFixed(1)} but CTR ${(total.ctr * 100).toFixed(2)}%: review title/description against the query`,
      verificationRequired: false,
    };
  }
  return none("no rule matched: existing page appears to serve the query");
}

export function buildOpportunities(
  rows: readonly SearchRow[],
  inventory: SiteInventory,
  evidence: { source: string; dataClass: DataClass },
  options: OpportunityOptions = DEFAULT_OPPORTUNITY_OPTIONS,
): Opportunity[] {
  return groupByQuery(rows)
    .map((group) => {
      const intent = classifyQuery(group.query, inventory.exams);
      const page = group.topPage ? findPage(inventory, group.topPage) : null;
      const decision = decide(intent, group, page, inventory, options);
      const examTools = intent.examId ? (inventory.liveToolsByExam[intent.examId] ?? []) : [];
      const examGuide = inventory.pages.find(
        (p) => p.kind === "guide" && intent.examId !== null && p.examId === intent.examId,
      );
      return {
        query: group.query,
        intent: intent.intent,
        intentRule: intent.rule,
        examId: intent.examId,
        impressions: group.total.impressions,
        clicks: group.total.clicks,
        ctr: group.total.ctr,
        position: group.total.position,
        page: group.topPage,
        existingTool: page?.toolId ?? examTools[0] ?? null,
        existingGuide: page?.guideSlug ?? examGuide?.guideSlug ?? null,
        ...decision,
        evidence,
      };
    })
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));
}

/** Queries in `current` that don't appear in `previous` (new query discovery). */
export function newQueries(
  current: readonly SearchRow[],
  previous: readonly SearchRow[],
): Aggregate[] {
  const seen = new Set(previous.map((row) => row.query).filter(Boolean));
  return groupByQuery(current)
    .filter((group) => !seen.has(group.query))
    .map((group) => group.total)
    .sort((a, b) => b.impressions - a.impressions || a.key.localeCompare(b.key));
}

/** Declares the evidence class of an export. The committed fixture carries a FAKE DATA marker. */
export function dataClassOf(csvText: string): DataClass {
  return /^#\s*FAKE DATA/m.test(csvText) ? "TEST_FIXTURE" : "REAL";
}
