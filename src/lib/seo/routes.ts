import { TOOLS } from "@/lib/tools/registry";

export interface SiteRoute {
  path: string;
  /** Included in sitemap.xml. Placeholder pages stay out until they have real content. */
  inSitemap: boolean;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
}

const STATIC_ROUTES: readonly SiteRoute[] = [
  { path: "/", inSitemap: true, priority: 1, changeFrequency: "weekly" },
  { path: "/tools", inSitemap: true, priority: 0.8, changeFrequency: "monthly" },
  { path: "/guides", inSitemap: false, priority: 0.5, changeFrequency: "weekly" },
  { path: "/privacy", inSitemap: true, priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", inSitemap: true, priority: 0.2, changeFrequency: "yearly" },
];

export function listSiteRoutes(): SiteRoute[] {
  return [
    ...STATIC_ROUTES,
    ...TOOLS.map((tool): SiteRoute => ({
      path: tool.path,
      inSitemap: tool.status === "live",
      priority: tool.exam ? 0.9 : 0.7,
      changeFrequency: "monthly",
    })),
  ];
}
