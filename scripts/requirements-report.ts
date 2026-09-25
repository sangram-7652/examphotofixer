/**
 * Developer report of every preset's verification state (read-only).
 *
 *   npm run requirements:report                      # table + audit, as of today
 *   npm run requirements:report -- --today 2027-01-15
 *   npm run requirements:report -- --impact ibps-photo
 *   npm run requirements:report -- --write           # regenerate docs/REQUIREMENT_MONITORING.md table
 *
 * Never changes a requirement. See docs/REQUIREMENT_MONITORING.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { listPresets } from "../src/lib/presets/index.ts";
import { auditPreset, changeImpact, monitoringReport } from "../src/lib/requirements/monitoring.ts";
import { formatMonitoringTable, replaceGenerated } from "../src/lib/requirements/report.ts";

const DOC = "docs/REQUIREMENT_MONITORING.md";

function main(argv: string[]): number {
  const todayIndex = argv.indexOf("--today");
  const today = todayIndex >= 0 ? argv[todayIndex + 1] : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today ?? "")) {
    console.error("--today must be YYYY-MM-DD");
    return 2;
  }
  const impactIndex = argv.indexOf("--impact");
  if (impactIndex >= 0) {
    const id = argv[impactIndex + 1];
    if (!listPresets().some((preset) => preset.id === id)) {
      console.error(`Unknown preset: ${id}`);
      return 2;
    }
    const impact = changeImpact(id);
    console.log(`Change impact of ${id}`);
    console.log("Tools:", impact.tools.map((t) => `${t.id} (${t.path})`).join(", ") || "none");
    console.log("Guides:", impact.guides.map((g) => g.path).join(", ") || "none");
    console.log("Checklist:\n" + impact.checklist.map((line) => `  - ${line}`).join("\n"));
    return 0;
  }

  const rows = monitoringReport(today);
  const table = formatMonitoringTable(rows, today);
  if (argv.includes("--write")) {
    writeFileSync(DOC, replaceGenerated(readFileSync(DOC, "utf8"), table));
    console.log(`Updated ${DOC} (as of ${today}).`);
  } else {
    console.log(table);
  }

  let findings = 0;
  console.log("\nAudit:");
  for (const preset of listPresets()) {
    const list = auditPreset(preset);
    findings += list.length;
    console.log(`  ${preset.id}: ${list.length === 0 ? "ok" : list.join("; ")}`);
  }
  const attention = rows.filter((row) => row.status !== "VERIFIED");
  console.log(
    `\n${attention.length} preset(s) need attention; ${findings} audit finding(s).` +
      (attention.length > 0
        ? ` ${attention.map((r) => `${r.presetId}=${r.status}`).join(", ")}`
        : ""),
  );
  return findings > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
