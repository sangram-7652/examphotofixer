/**
 * Local Search Console CSV analysis. Reads files you exported yourself and
 * prints a report; sends nothing anywhere and writes nothing.
 *
 *   npm run search:report -- <export.csv> [more.csv ...] [--limit 20]
 *     [--min-impressions 100] [--max-ctr 0.02]
 *
 * See docs/SEARCH_DATA_ANALYSIS.md.
 */

import { readFileSync } from "node:fs";
import { buildReport, formatReport, parseSearchConsoleCsv } from "../src/lib/search-data/gsc.ts";

function main(argv: string[]): number {
  const files: string[] = [];
  const options = { limit: 20, minImpressions: 100, maxCtr: 0.02 };
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
    } else {
      files.push(arg);
    }
  }
  if (files.length === 0) {
    console.error("Usage: npm run search:report -- <search-console-export.csv> [...]");
    return 2;
  }
  for (const file of files) {
    try {
      const rows = parseSearchConsoleCsv(readFileSync(file, "utf8"));
      console.log(formatReport(buildReport(rows, options), file));
    } catch (error) {
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
