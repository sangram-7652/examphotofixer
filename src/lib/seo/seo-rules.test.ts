import { describe, expect, it } from "vitest";
import { absoluteUrl } from "@/config/site";
import { listGuides } from "@/content/guides";
import { TOOLS } from "@/lib/tools/registry";
import { buildPageMetadata, buildToolMetadata } from "./metadata";
import { listSiteRoutes } from "./routes";

const sitemapPaths = () =>
  listSiteRoutes()
    .filter((r) => r.inSitemap)
    .map((r) => r.path);

describe("sitemap rules", () => {
  it("includes home, tools, guides, every live tool and every published guide", () => {
    const paths = sitemapPaths();
    for (const path of ["/", "/tools", "/guides", "/privacy", "/terms"])
      expect(paths).toContain(path);
    for (const tool of TOOLS.filter((t) => t.status === "live")) expect(paths).toContain(tool.path);
    for (const guide of listGuides()) expect(paths).toContain(`/guides/${guide.slug}`);
  });

  it("excludes placeholders, redirects, test routes and duplicates", () => {
    const paths = sitemapPaths();
    for (const tool of TOOLS.filter((t) => t.status !== "live"))
      expect(paths).not.toContain(tool.path);
    expect(paths).not.toContain("/ccc-image-resizer");
    expect(paths.some((p) => p.startsWith("/dev"))).toBe(false);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path === "/" || !path.endsWith("/")).toBe(true);
  });
});

describe("index / canonical rules", () => {
  it("live tools are indexable; coming-soon tools are noindex", () => {
    for (const tool of TOOLS) {
      const meta = buildToolMetadata(tool);
      if (tool.status === "live") expect(meta.robots).toBeUndefined();
      else expect(meta.robots).toMatchObject({ index: false });
    }
    expect(buildToolMetadata({ ...TOOLS[0], status: "coming-soon" }).robots).toMatchObject({
      index: false,
    });
  });

  it("canonical is the page's own path, with no query string or trailing slash", () => {
    const meta = buildPageMetadata({
      title: "t",
      description: "d",
      path: "/guides/ccc-photo-size",
    });
    expect(meta.alternates?.canonical).toBe("/guides/ccc-photo-size");
    expect(meta.openGraph).toMatchObject({ url: "/guides/ccc-photo-size" });
    for (const tool of TOOLS) {
      expect(buildToolMetadata(tool).alternates?.canonical).toBe(tool.path);
    }
  });

  it("absolute URLs use one normalised host", () => {
    expect(absoluteUrl("/")).not.toMatch(/\/$/);
    expect(absoluteUrl("/tools")).toBe(`${absoluteUrl("/")}/tools`);
  });
});
