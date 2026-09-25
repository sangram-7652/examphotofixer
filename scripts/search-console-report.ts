/**
 * Local Search Console CSV analysis. Reads files you exported yourself and
 * prints a report; sends nothing anywhere and writes nothing.
 *
 *   npm run search:report -- <export.csv> [more.csv ...] [--limit 20]
 *     [--min-impressions 100] [--max-ctr 0.02] [--previous older.csv] [--events events.ndjson]
 *
 * Every report starts with its data class: REAL (an export you supplied) or TEST_FIXTURE (the
 * committed fake sample). See docs/SEARCH_DATA_ANALYSIS.md and docs/GROWTH_PLAN.md.
 */

import { readFileSync } from "node:fs";
import { engagementByRoute, parseEventExport } from "../src/lib/analytics/report.ts";
import { buildReport, formatReport, parseSearchConsoleCsv } from "../src/lib/search-data/gsc.ts";
import { classifyQuery, SEARCH_INTENTS } from "../src/lib/search-data/intent.ts";
import {
  buildOpportunities,
  dataClassOf,
  newQueries,
} from "../src/lib/search-data/opportunities.ts";
import { buildSiteInventory } from "../src/lib/search-data/site-inventory.ts";

const pct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(2)}%`);

function main(argv: string[]): number {
  const files: string[] = [];
  const options = { limit: 20, minImpressions: 100, maxCtr: 0.02 };
  let previous: string | null = null;
  let eventsFile: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const flags: Record<string, keyof typeof options> = {
      "--limit": "limit",
      "--min-impressions": "minImpressions",
      "--max-ctr": "maxCtr",
    };
    if (arg in flags) {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value < 0) {
        console.error(`Invalid value for ${arg}`);
        return 2;
      }
      options[flags[arg]] = value;
    } else if (arg === "--previous" || arg === "--events") {
      const value = argv[++i];
      if (!value) {
        console.error(`Missing file for ${arg}`);
        return 2;
      }
      if (arg === "--previous") previous = value;
      else eventsFile = value;
    } else {
      files.push(arg);
    }
  }
  if (files.length === 0) {
    console.error("Usage: npm run search:report -- <search-console-export.csv> [...]");
    return 2;
  }
  const inventory = buildSiteInventory();
  for (const file of files) {
    try {
      const text = readFileSync(file, "utf8");
      const dataClass = dataClassOf(text);
      const rows = parseSearchConsoleCsv(text);
      console.log(
        dataClass === "TEST_FIXTURE"
          ? "DATA CLASS: TEST_FIXTURE — invented data. Do not quote any number as site traffic.\n"
          : "DATA CLASS: REAL — as exported by you. Quote numbers only with their date range.\n",
      );
      console.log(formatReport(buildReport(rows, options), file));

      const lines: string[] = [];
      if (rows.some((row) => row.query !== undefined)) {
        const byIntent = new Map(
          SEARCH_INTENTS.map((intent) => [intent, { queries: 0, impressions: 0, clicks: 0 }]),
        );
        for (const row of rows) {
          if (!row.query) continue;
          const entry = byIntent.get(classifyQuery(row.query, inventory.exams).intent)!;
          entry.queries++;
          entry.impressions += row.impressions;
          entry.clicks += row.clicks;
        }
        lines.push("## Search intent (rows, impressions, clicks)");
        for (const [intent, entry] of byIntent) {
          lines.push(`${intent}\t${entry.queries}\t${entry.impressions}\t${entry.clicks}`);
        }
        lines.push("", "## Opportunities (proposals only; see docs/GROWTH_PLAN.md)");
        const opportunities = buildOpportunities(
          rows,
          inventory,
          { source: file, dataClass },
          {
            minImpressions: options.minImpressions,
            lowCtr: options.maxCtr,
            goodPosition: 10,
          },
        );
        const actionable = opportunities.filter((o) => o.type !== "NO_ACTION");
        if (actionable.length === 0) lines.push("(none above the evidence threshold)");
        for (const o of actionable.slice(0, options.limit)) {
          lines.push(
            `${o.type}${o.verificationRequired ? " [verify official source first]" : ""}\t${o.query}\t` +
              `${o.intent}\t${o.impressions} impr\t${o.clicks} clicks\tCTR ${pct(o.ctr)}\t` +
              `pos ${o.position === null ? "—" : o.position.toFixed(1)}\t${o.page ?? "-"}\n    ${o.reason}`,
          );
        }
        lines.push(
          `(${opportunities.length - actionable.length} queries: NO_ACTION, mostly below ${options.minImpressions} impressions)`,
          "",
        );
      } else {
        lines.push(
          "## Search intent / Opportunities",
          "(not available: this export has no query column)",
          "",
        );
      }

      lines.push("## New queries since the previous export");
      if (!previous) {
        lines.push("(not run: pass --previous <older export.csv>)", "");
      } else {
        const found = newQueries(rows, parseSearchConsoleCsv(readFileSync(previous, "utf8")));
        lines.push(
          ...(found.length === 0
            ? ["(none)"]
            : found.slice(0, options.limit).map((q) => `${q.key}\t${q.clicks}\t${q.impressions}`)),
          "",
        );
      }

      lines.push("## Pages with clicks but weak engagement (joins on-site events)");
      if (!eventsFile) {
        lines.push(
          "(not run: pass --events <exported events.ndjson>; no analytics provider exists yet)",
          "",
        );
      } else {
        const engagement = engagementByRoute(
          parseEventExport(readFileSync(eventsFile, "utf8")),
          100,
        );
        const clicksByPath = new Map<string, number>();
        for (const row of rows) {
          if (!row.page) continue;
          const path = new URL(row.page).pathname.replace(/\/+$/, "") || "/";
          clicksByPath.set(path, (clicksByPath.get(path) ?? 0) + row.clicks);
        }
        lines.push("route\tsearch clicks\tpage views\tengaged\trate (per view; — below 100 views)");
        for (const route of engagement) {
          lines.push(
            `${route.route}\t${clicksByPath.get(route.route) ?? 0}\t${route.pageViews}\t${route.engaged}\t` +
              pct(route.engagementRate.rate),
          );
        }
        lines.push("");
      }
      console.log(lines.join("\n"));
    } catch (error) {
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
