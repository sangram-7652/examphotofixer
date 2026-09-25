/**
 * Privacy-safe context added to every event, and acquisition categorisation
 * for the landing page view. No full referrer URLs, no search queries and only
 * three whitelisted UTM keys are ever reported.
 */

export type PageCategory =
  "home" | "tools_index" | "tool" | "guides_index" | "guide" | "legal" | "other";

export type ReferrerCategory = "direct" | "organic_search" | "social" | "referral" | "other";

/** Pathname only (never the query), and only if it's made of safe characters. */
export function normalizeRoute(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return /^\/[a-z0-9\-/]{0,63}$/.test(path) ? path : "other";
}

export function pageCategory(route: string): PageCategory {
  if (route === "/") return "home";
  if (route === "/tools") return "tools_index";
  if (route === "/guides") return "guides_index";
  if (route.startsWith("/guides/")) return "guide";
  if (route === "/privacy" || route === "/terms") return "legal";
  if (/^\/[a-z0-9-]+-(resizer|compressor|pack)$/.test(route)) return "tool";
  return "other";
}

export function deviceClass(viewportWidth: number): "mobile" | "tablet" | "desktop" {
  if (viewportWidth < 640) return "mobile";
  if (viewportWidth < 1024) return "tablet";
  return "desktop";
}

export function browserFamily(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "edge";
  if (/SamsungBrowser\//.test(userAgent)) return "samsung";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/(Chrome|CriOS)\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "other";
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|search\.brave)\./i;
const SOCIAL =
  /(^|\.)(facebook|instagram|t\.co|twitter|x\.com|linkedin|youtube|reddit|whatsapp|telegram|pinterest|quora)\b/i;

/** Categorises a referrer by host only; the URL itself is never reported. */
export function referrerCategory(referrer: string, ownHost: string): ReferrerCategory {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === ownHost.toLowerCase()) return "direct";
  if (SEARCH.test(host)) return "organic_search";
  if (SOCIAL.test(host)) return "social";
  return "referral";
}

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** Only whitelisted UTM keys with short, simple values; everything else is ignored. */
export function utmParams(search: string): Partial<Record<(typeof UTM_KEYS)[number], string>> {
  const params = new URLSearchParams(search);
  const out: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim().toLowerCase();
    if (value && /^[a-z0-9_\-.]{1,40}$/.test(value)) out[key] = value;
  }
  return out;
}
