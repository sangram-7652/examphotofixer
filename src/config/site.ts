/**
 * Site-wide brand and deployment configuration.
 *
 * `NEXT_PUBLIC_SITE_URL` must be set to the canonical production origin in
 * production. `NEXT_PUBLIC_SITE_INDEXABLE` must be exactly "true" before search
 * engines are allowed to index the site (kept off until tools are functional).
 */

const FALLBACK_SITE_URL = "https://examphotofixer.com";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const url = raw && raw.length > 0 ? raw : FALLBACK_SITE_URL;
  return url.replace(/\/+$/, "");
}

function resolveContactEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return raw && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(raw) ? raw : null;
}

export const siteConfig = {
  name: "ExamPhotoFixer",
  tagline: "Fix it before you upload.",
  category: "Exam & Application File Tools",
  description:
    "Resize, compress, crop and validate photos, signatures and thumb impressions for online exam and application forms.",
  url: resolveSiteUrl(),
  locale: "en_IN",
  indexable: process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true",
  /** Public contact address shown on /privacy; unset until the owner provides one. */
  contactEmail: resolveContactEmail(),
} as const;

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? siteConfig.url : `${siteConfig.url}${normalized}`;
}
