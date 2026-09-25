/** Markdown rendering of the monitoring report (docs/REQUIREMENT_MONITORING.md). */

import type { MonitoringRow } from "./monitoring";

export const BEGIN = "<!-- BEGIN GENERATED: npm run requirements:report -- --write -->";
export const END = "<!-- END GENERATED -->";

const ASSET_LABELS: Record<string, string> = {
  photo: "Photo",
  signature: "Signature",
  "left-thumb-impression": "Left thumb impression",
  "handwritten-declaration": "Hand-written declaration",
};

export function formatMonitoringTable(rows: readonly MonitoringRow[], today: string): string {
  const lines = [
    `Status as of ${today}. Review interval: 90 days after the last verification event.`,
    "",
    "| Exam | Asset | Preset | Source (version, published) | SHA-256 | Verified | Review after | Status | Last check | Versions |",
    "| ---- | ----- | ------ | --------------------------- | ------- | -------- | ------------ | ------ | ---------- | -------- |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.exam.toUpperCase()} | ${ASSET_LABELS[row.asset] ?? row.asset} | \`${row.presetId}\` | ` +
        `\`${row.sourceId}\` (${row.version}, ${row.published}) | \`${row.sha256.slice(0, 12)}…\` | ` +
        `${row.verifiedOn} | ${row.reviewAfter} | **${row.status}** | ${row.lastOutcome} | ${row.versions} |`,
    );
  }
  return lines.join("\n");
}

/** Replaces the generated block in a document; throws if the markers are missing. */
export function replaceGenerated(document: string, table: string): string {
  const start = document.indexOf(BEGIN);
  const end = document.indexOf(END);
  if (start < 0 || end < start) throw new Error("Generated-block markers not found.");
  return `${document.slice(0, start + BEGIN.length)}\n\n${table}\n\n${document.slice(end)}`;
}

/** The "as of" date and table of the generated block, for drift checks. */
export function readGenerated(document: string): { today: string; table: string } | null {
  const start = document.indexOf(BEGIN);
  const end = document.indexOf(END);
  if (start < 0 || end < start) return null;
  const table = document.slice(start + BEGIN.length, end).trim();
  const today = /Status as of (\d{4}-\d{2}-\d{2})/.exec(table)?.[1];
  return today ? { today, table } : null;
}
