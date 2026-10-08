import type { ImagePreset, RequirementSource } from "./types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-09-24" → "24 September 2026". Locale-independent so server and client render the same. */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * The printed `version`, or "" when it isn't a real document revision to show as "Version X" —
 * e.g. an edition/cycle identifier (like IBPS's "XV") that's already named in `document`. Shared
 * by every place that renders a source's version, so this only needs deciding once per source.
 */
export function versionFragment(source: RequirementSource): string {
  if (!source.version) return "";
  if (source.document?.includes(source.version)) return "";
  return source.version;
}

/**
 * Human-readable citation, e.g.
 * "NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)".
 */
export function sourceCitation(source: RequirementSource): string {
  const title = source.document ? `${source.authority} ${source.document}` : source.authority;
  const fragment = versionFragment(source);
  const version = fragment ? `, Version ${fragment}` : "";
  const published = source.published ? ` (${source.published})` : "";
  return `${title}${version}${published}`;
}

/** True when the source can be shown as verified: status, link and date are all present. */
export function isVerifiedSource(source: RequirementSource): boolean {
  return source.status === "verified" && source.url !== null && source.verifiedOn !== null;
}

/** Pages where a preset's values appear: its own `sourcePages`, else the source's `page`. */
export function presetSourcePages(preset: ImagePreset): number[] {
  if (preset.sourcePages && preset.sourcePages.length > 0) return [...preset.sourcePages];
  return preset.source.page ? [preset.source.page] : [];
}

/** "page 3", "pages 56 and 58", "pages 56, 57 and 58"; "" when no page is recorded. */
export function formatPages(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `page ${sorted[0]}`;
  return `pages ${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

export function isPdf(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url);
}
