import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    // /dev/ holds the engine test harness (404 in production); keep crawlers away anyway.
    rules: { userAgent: "*", allow: "/", disallow: "/dev/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
