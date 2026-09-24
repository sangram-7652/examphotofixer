import type { RequirementSource } from "./types";

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
 * Human-readable citation, e.g.
 * "NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)".
 */
export function sourceCitation(source: RequirementSource): string {
  const title = source.document ? `${source.authority} ${source.document}` : source.authority;
  const version = source.version ? `, Version ${source.version}` : "";
  const published = source.published ? ` (${source.published})` : "";
  return `${title}${version}${published}`;
}

/** True when the source can be shown as verified: status, link and date are all present. */
export function isVerifiedSource(source: RequirementSource): boolean {
  return source.status === "verified" && source.url !== null && source.verifiedOn !== null;
}

export function isPdf(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url);
}
