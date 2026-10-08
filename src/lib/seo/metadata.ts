import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Route path, e.g. "/ccc-photo-resizer". Used for the canonical URL. */
  path: string;
  /** Force noindex for this page (e.g. placeholder pages without content yet). */
  noIndex?: boolean;
  /**
   * Real publish/modify dates for an editorial page (e.g. a guide) — switches Open Graph type
   * to "article". Omit for tool/product pages, which stay "website". Never pass a fabricated date.
   */
  article?: { publishedTime: string; modifiedTime: string };
}

/** Metadata for a tool route; placeholder (coming-soon) tools are kept out of the index. */
export function buildToolMetadata(tool: {
  metaTitle: string;
  metaDescription: string;
  path: string;
  status: "live" | "coming-soon";
}): Metadata {
  return buildPageMetadata({
    title: tool.metaTitle,
    description: tool.metaDescription,
    path: tool.path,
    noIndex: tool.status !== "live",
  });
}

/** Per-page metadata with canonical URL and Open Graph/Twitter tags. */
export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
  article,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: article
      ? {
          type: "article",
          siteName: siteConfig.name,
          locale: siteConfig.locale,
          url: path,
          title,
          description,
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
        }
      : {
          type: "website",
          siteName: siteConfig.name,
          locale: siteConfig.locale,
          url: path,
          title,
          description,
        },
    twitter: { card: "summary", title, description },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
