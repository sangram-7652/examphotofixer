import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { listSiteRoutes } from "@/lib/seo/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  return listSiteRoutes()
    .filter((route) => route.inSitemap)
    .map((route) => ({
      url: absoluteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));
}
