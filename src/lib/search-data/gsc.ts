/**
 * Offline analysis of Google Search Console exports. Pure functions: parse a
 * CSV the site owner downloaded, aggregate it, and derive the analyses in
 * docs/SEARCH_DATA_ANALYSIS.md. No network, no storage, no third parties.
 *
 * Accepts the performance report's per-dimension CSVs ("Top queries", "Top
 * pages", "Countries", "Devices", "Dates") and row-level exports with several
 * dimension columns (Search Console API / bulk export shape). CTR and average
 * position are recomputed from clicks, impressions and position, never taken
 * from the percentage column.
 *
 * Written without TypeScript-only runtime syntax so the CLI can run it with
 * Node's type stripping.
 */

export type Dimension = "query" | "page" | "country" | "device" | "date";

export const DIMENSIONS: readonly Dimension[] = ["query", "page", "country", "device", "date"];

export interface SearchRow {
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  date?: string;
  clicks: number;
  impressions: number;
  /** Average position for the row, when present. */
  position: number | null;
}

export interface Aggregate {
  key: string;
  clicks: number;
  impressions: number;
  /** clicks ÷ impressions; `null` when there are no impressions. */
  ctr: number | null;
  /** Impression-weighted average position; `null` when unknown. */
  position: number | null;
}

const HEADER_ALIASES: Record<string, Dimension | "clicks" | "impressions" | "position" | "ctr"> = {
  query: "query",
  queries: "query",
  "top queries": "query",
  page: "page",
  pages: "page",
  "top pages": "page",
  url: "page",
  country: "country",
  countries: "country",
  device: "device",
  devices: "device",
  date: "date",
  dates: "date",
  clicks: "clicks",
  impressions: "impressions",
  ctr: "ctr",
  "url ctr": "ctr",
  position: "position",
  "average position": "position",
};

/** RFC 4180 CSV: quoted fields, escaped quotes, CRLF/LF. Lines starting with "#" are comments. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let atLineStart = true;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (atLineStart && !quoted && char === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    atLineStart = false;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      atLineStart = true;
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const cleaned = value.replace(/[%,\s]/g, "");
  if (cleaned === "") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

/** Parses a Search Console CSV export into rows. Throws on a file it can't interpret. */
export function parseSearchConsoleCsv(text: string): SearchRow[] {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error("The CSV file is empty.");
  const columns = header.map((name) => HEADER_ALIASES[name.trim().toLowerCase()] ?? null);
  const index = (name: string) => columns.indexOf(name as never);
  if (index("clicks") < 0 || index("impressions") < 0) {
    throw new Error(
      "Expected Clicks and Impressions columns (a Search Console performance export).",
    );
  }
  if (!DIMENSIONS.some((dimension) => index(dimension) >= 0)) {
    throw new Error(
      "Expected at least one dimension column: query, page, country, device or date.",
    );
  }
  return body.map((cells, line) => {
    const clicks = toNumber(cells[index("clicks")]);
    const impressions = toNumber(cells[index("impressions")]);
    if (clicks === null || impressions === null || clicks < 0 || impressions < clicks) {
      throw new Error(`Row ${line + 2}: invalid clicks/impressions.`);
    }
    const row: SearchRow = {
      clicks,
      impressions,
      position: index("position") >= 0 ? toNumber(cells[index("position")]) : null,
    };
    for (const dimension of DIMENSIONS) {
      if (index(dimension) >= 0) row[dimension] = (cells[index(dimension)] ?? "").trim();
    }
    return row;
  });
}

export function dimensionsIn(rows: readonly SearchRow[]): Dimension[] {
  return DIMENSIONS.filter((dimension) => rows.some((row) => row[dimension] !== undefined));
}

/** Sums rows by one or more dimensions (joined with " | " in the key). */
export function aggregate(rows: readonly SearchRow[], by: readonly Dimension[]): Aggregate[] {
  const groups = new Map<
    string,
    { clicks: number; impressions: number; weighted: number; known: number }
  >();
  for (const row of rows) {
    if (by.some((dimension) => row[dimension] === undefined)) continue;
    const key = by.map((dimension) => row[dimension]).join(" | ");
    const group = groups.get(key) ?? { clicks: 0, impressions: 0, weighted: 0, known: 0 };
    group.clicks += row.clicks;
    group.impressions += row.impressions;
    if (row.position !== null) {
      group.weighted += row.position * row.impressions;
      group.known += row.impressions;
    }
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({
    key,
    clicks: group.clicks,
    impressions: group.impressions,
    ctr: group.impressions > 0 ? group.clicks / group.impressions : null,
    position: group.known > 0 ? group.weighted / group.known : null,
  }));
}

export function topBy(
  items: readonly Aggregate[],
  metric: "clicks" | "impressions",
  limit: number,
): Aggregate[] {
  return [...items]
    .sort((a, b) => b[metric] - a[metric] || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export interface LowCtrOptions {
  /** Only queries with at least this many impressions. */
  minImpressions: number;
  /** CTR strictly below this (0–1). */
  maxCtr: number;
}

/** High-impression, low-CTR items: shown often, rarely clicked. Sorted by impressions. */
export function highImpressionLowCtr(
  items: readonly Aggregate[],
  { minImpressions, maxCtr }: LowCtrOptions,
): Aggregate[] {
  return topBy(
    items.filter((item) => item.impressions >= minImpressions && (item.ctr ?? 0) < maxCtr),
    "impressions",
    Number.POSITIVE_INFINITY,
  );
}

export interface SearchReport {
  rowCount: number;
  dimensions: Dimension[];
  totals: Aggregate;
  topQueriesByImpressions: Aggregate[];
  topQueriesByClicks: Aggregate[];
  lowCtrQueries: Aggregate[];
  topPagesByImpressions: Aggregate[];
  topPagesByClicks: Aggregate[];
  queryPage: Aggregate[];
  devices: Aggregate[];
  countries: Aggregate[];
  /** Chronological. */
  dates: Aggregate[];
}

export function buildReport(
  rows: readonly SearchRow[],
  options: LowCtrOptions & { limit: number },
): SearchReport {
  const queries = aggregate(rows, ["query"]);
  const pages = aggregate(rows, ["page"]);
  const [totals] = aggregate(
    rows.map((row) => ({ ...row, date: "all" })),
    ["date"],
  );
  return {
    rowCount: rows.length,
    dimensions: dimensionsIn(rows),
    totals: totals ?? { key: "all", clicks: 0, impressions: 0, ctr: null, position: null },
    topQueriesByImpressions: topBy(queries, "impressions", options.limit),
    topQueriesByClicks: topBy(queries, "clicks", options.limit),
    lowCtrQueries: highImpressionLowCtr(queries, options).slice(0, options.limit),
    topPagesByImpressions: topBy(pages, "impressions", options.limit),
    topPagesByClicks: topBy(pages, "clicks", options.limit),
    queryPage: topBy(aggregate(rows, ["query", "page"]), "impressions", options.limit),
    devices: topBy(aggregate(rows, ["device"]), "impressions", Number.POSITIVE_INFINITY),
    countries: topBy(aggregate(rows, ["country"]), "impressions", options.limit),
    dates: aggregate(rows, ["date"]).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function formatAggregate(item: Aggregate): string {
  const ctr = item.ctr === null ? "—" : `${(item.ctr * 100).toFixed(2)}%`;
  const position = item.position === null ? "—" : item.position.toFixed(1);
  return `${item.key}\t${item.clicks}\t${item.impressions}\t${ctr}\t${position}`;
}

export function formatReport(report: SearchReport, source: string): string {
  const lines: string[] = [
    `Search Console analysis of ${source}`,
    `Rows: ${report.rowCount}. Dimensions present: ${report.dimensions.join(", ") || "none"}.`,
    `Totals: ${report.totals.clicks} clicks, ${report.totals.impressions} impressions.`,
    "",
  ];
  const section = (title: string, items: readonly Aggregate[], needs: Dimension[]) => {
    lines.push(`## ${title}`);
    if (!needs.every((dimension) => report.dimensions.includes(dimension))) {
      lines.push(`(not available: this export has no ${needs.join(" + ")} column)`, "");
      return;
    }
    if (items.length === 0) {
      lines.push("(none)", "");
      return;
    }
    lines.push("key\tclicks\timpressions\tctr\tposition", ...items.map(formatAggregate), "");
  };
  section("Top queries by impressions", report.topQueriesByImpressions, ["query"]);
  section("Top queries by clicks", report.topQueriesByClicks, ["query"]);
  section("High-impression, low-CTR queries", report.lowCtrQueries, ["query"]);
  section("Top pages by impressions", report.topPagesByImpressions, ["page"]);
  section("Top pages by clicks", report.topPagesByClicks, ["page"]);
  section("Query + page combinations", report.queryPage, ["query", "page"]);
  section("Devices", report.devices, ["device"]);
  section("Countries", report.countries, ["country"]);
  section("Dates", report.dates, ["date"]);
  return lines.join("\n");
}
