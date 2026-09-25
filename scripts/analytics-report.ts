/**
 * Offline funnel and problem-discovery report over an exported event stream (NDJSON, one
 * sanitized `{ "name", "props" }` per line). Reads a local file; sends nothing anywhere.
 *
 *   npm run analytics:report -- <events.ndjson> [--min-sample 100]
 *
 * Rates below the minimum sample are shown as "insufficient". No analytics provider is
 * installed yet, so no real export exists. See docs/GROWTH_PLAN.md.
 */

import { readFileSync } from "node:fs";
import {
  funnelByTool,
  funnelCounts,
  gatedFunnel,
  parseEventExport,
  reasonCounts,
} from "../src/lib/analytics/report.ts";

function main(argv: string[]): number {
  const minIndex = argv.indexOf("--min-sample");
  const minSample = minIndex >= 0 ? Number(argv[minIndex + 1]) : 100;
  const file = argv.find((arg, index) => !arg.startsWith("--") && index !== minIndex + 1);
  if (!file || !Number.isFinite(minSample) || minSample < 1) {
    console.error("Usage: npm run analytics:report -- <events.ndjson> [--min-sample 100]");
    return 2;
  }
  let events;
  try {
    events = parseEventExport(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const fake = /^#\s*FAKE DATA/m.test(readFileSync(file, "utf8"));
  const lines = [
    fake
      ? "DATA CLASS: TEST_FIXTURE — invented data. Do not quote any number as site usage."
      : "DATA CLASS: REAL — as exported by you. Quote numbers only with their date range.",
    "",
  ];
  lines.push(
    `Analytics report of ${file}: ${events.length} events. Minimum sample: ${minSample}.`,
    "",
  );
  const section = (title: string, counts: ReturnType<typeof funnelCounts>) => {
    lines.push(`## ${title}`);
    for (const [name, value] of Object.entries(counts)) lines.push(`${name}\t${value}`);
    for (const [name, gated] of Object.entries(gatedFunnel(counts, minSample))) {
      lines.push(
        `${name}\t${gated.sufficient && gated.rate !== null ? `${(gated.rate * 100).toFixed(1)}%` : "insufficient"}\t(n=${gated.denominator})`,
      );
    }
    lines.push("");
  };
  section("All tools", funnelCounts(events));
  for (const [tool, counts] of funnelByTool(events)) section(`Tool ${tool}`, counts);

  lines.push("## Problem discovery (reason / error codes)");
  for (const [event, counts] of Object.entries(reasonCounts(events))) {
    lines.push(`${event}:`);
    if (counts.length === 0) lines.push("  (none)");
    for (const c of counts) {
      lines.push(
        `  ${c.key}\t${c.count}\t${(c.share * 100).toFixed(1)}%${c.count < minSample ? "\t(below minimum sample: observe, don't act)" : ""}`,
      );
    }
  }
  console.log(lines.join("\n"));
  return 0;
}

process.exitCode = main(process.argv.slice(2));
