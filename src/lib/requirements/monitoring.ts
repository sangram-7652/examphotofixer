/**
 * Requirement monitoring: review status, metadata audit and change impact for every preset.
 * Read-only: nothing here changes a requirement. Statuses are signals for a person, never an
 * automatic verdict (an old verification is REVIEW_DUE, not invalid).
 *
 * Operational view: `npm run requirements:report` and docs/REQUIREMENT_MONITORING.md.
 */

import { guidePath, listGuides } from "@/content/guides";
import { latestEvent, requirementVersions, type RequirementSnapshot } from "@/lib/presets/history";
import { listPresets } from "@/lib/presets";
import { presetSourcePages } from "@/lib/presets/source";
import type { ImagePreset } from "@/lib/presets/types";
import { TOOLS } from "@/lib/tools/registry";

export type MonitoringStatus =
  "VERIFIED" | "REVIEW_DUE" | "SOURCE_CHANGED" | "UNDER_REVIEW" | "SUPERSEDED";

/** Days after the last verification event when a source is due for review. */
export const REVIEW_INTERVAL_DAYS = 90;

/**
 * States a person sets while a source is being handled (docs/EXAM_REQUIREMENT_VERIFICATION.md,
 * "Source change workflow"). Empty means no source is under review.
 */
export const SOURCE_STATES: Readonly<
  Record<string, { state: "SOURCE_CHANGED" | "UNDER_REVIEW"; since: string; note: string }>
> = {};

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function snapshotOf(preset: ImagePreset): RequirementSnapshot {
  return {
    width: preset.width,
    height: preset.height,
    preferredDimensions: preset.preferredDimensions ?? false,
    fileSizeKB: { min: preset.fileSizeKB.min, max: preset.fileSizeKB.max },
    dpi: { min: preset.dpi.min, max: preset.dpi.max },
    formats: [...preset.formats],
  };
}

export interface MonitoringRow {
  presetId: string;
  exam: string;
  asset: string;
  sourceId: string;
  version: string;
  published: string;
  sha256: string;
  verifiedOn: string;
  reviewAfter: string;
  status: MonitoringStatus;
  lastOutcome: string;
  versions: number;
}

export function monitoringRow(preset: ImagePreset, today: string): MonitoringRow {
  const event = latestEvent(preset.source.id);
  const verifiedOn = event?.date ?? preset.source.verifiedOn ?? "";
  const reviewAfter = verifiedOn ? addDays(verifiedOn, REVIEW_INTERVAL_DAYS) : "";
  const manual = SOURCE_STATES[preset.source.id];
  let status: MonitoringStatus = "VERIFIED";
  if (manual) status = manual.state;
  else if (event?.outcome === "UNCERTAIN" || event?.outcome === "CHANGED") {
    // CHANGED is resolved by a new event that records the new values; until then it's open.
    status = event.outcome === "CHANGED" ? "SOURCE_CHANGED" : "UNDER_REVIEW";
  } else if (!verifiedOn || today > reviewAfter) status = "REVIEW_DUE";
  return {
    presetId: preset.id,
    exam: preset.exam,
    asset: preset.documentType,
    sourceId: preset.source.id,
    version: preset.source.version ?? "",
    published: preset.source.published ?? "",
    sha256: preset.source.sha256 ?? "",
    verifiedOn,
    reviewAfter,
    status,
    lastOutcome: event?.outcome ?? "NONE",
    versions: requirementVersions(preset.id).length,
  };
}

export function monitoringReport(today: string): MonitoringRow[] {
  return listPresets().map((preset) => monitoringRow(preset, today));
}

/** Metadata audit: everything a verified preset must carry. Empty list = no findings. */
export function auditPreset(preset: ImagePreset): string[] {
  const findings: string[] = [];
  const { source } = preset;
  if (source.status !== "verified") findings.push(`source status is ${source.status}`);
  if (!source.url?.startsWith("https://")) findings.push("no https source URL");
  if (!source.document) findings.push("no document title");
  if (!source.version) findings.push("no version");
  if (!source.published) findings.push("no publication date");
  if (!source.verifiedOn) findings.push("no verification date");
  if (!source.sha256) findings.push("no SHA-256");
  if (presetSourcePages(preset).length === 0) findings.push("no page recorded");
  const event = latestEvent(source.id);
  if (!event) {
    findings.push("no verification event in history");
    return findings;
  }
  if (event.sha256 !== source.sha256) findings.push("source SHA-256 differs from the latest event");
  if (event.date !== source.verifiedOn) findings.push("verifiedOn differs from the latest event");
  const versions = requirementVersions(preset.id);
  const current = versions[versions.length - 1];
  if (!current) findings.push("preset missing from verification history");
  else if (JSON.stringify(current.snapshot) !== JSON.stringify(snapshotOf(preset))) {
    findings.push("preset values differ from the latest verified snapshot");
  } else if (current.lastVerified !== event.date) {
    findings.push("preset not covered by the latest verification event of its source");
  }
  return findings;
}

export interface ChangeImpact {
  presetId: string;
  tools: { id: string; path: string; kind: string }[];
  guides: { slug: string; path: string }[];
  /** Everything else that derives from the preset and must be re-checked after a change. */
  checklist: string[];
}

/** What a change to a preset touches. Values are derived everywhere, so this is a review list. */
export function changeImpact(presetId: string): ChangeImpact {
  const tools = TOOLS.filter((tool) => tool.presetIds.includes(presetId)).map((tool) => ({
    id: tool.id,
    path: tool.path,
    kind: tool.kind,
  }));
  const guides = listGuides()
    .filter((guide) => guide.presetIds.includes(presetId))
    .map((guide) => ({ slug: guide.slug, path: guidePath(guide) }));
  return {
    presetId,
    tools,
    guides,
    checklist: [
      "src/lib/presets/history.ts: add a verification event (never edit old ones)",
      "src/lib/presets/presets.test.ts: exact values for the new version",
      "Tool metadata (registry metaDescription) and tool-content copy: derived, re-read for wording",
      "Guide copy for the listed guides: derived values, re-read explanations and limitations",
      "docs/EXAM_REQUIREMENT_VERIFICATION.md, docs/FORM_PRESETS.md: history row and mapping",
      "docs/REQUIREMENT_MONITORING.md: regenerate (npm run requirements:report -- --write)",
      "docs/SEO_CHANGELOG.md: entry if titles/descriptions change",
      "Social posts and outreach (docs/GROWTH_PLAN.md §10–11): any post made with the old values is stale",
      "e2e for the listed tools: run the full browser matrix",
    ],
  };
}
