import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";
import { getGuide, listGuides } from "@/content/guides";
import { TOOLS } from "@/lib/tools/registry";
import { listSiteRoutes } from "./routes";

describe("site routes", () => {
  it.each(listSiteRoutes().map((route) => [route.path]))("%s has an App Router page", (path) => {
    const guide = /^\/guides\/([^/]+)$/.exec(path);
    // Guides are served by one statically generated dynamic route; the slug must be published.
    const file = join(process.cwd(), "src/app", guide ? "guides/[slug]" : path, "page.tsx");
    expect(existsSync(file), file).toBe(true);
    if (guide) expect(getGuide(guide[1]), path).toBeDefined();
  });

  it("keeps placeholder pages out of the sitemap; /guides is in only with published guides", () => {
    const routes = listSiteRoutes();
    for (const tool of TOOLS.filter((t) => t.status !== "live")) {
      expect(routes.find((route) => route.path === tool.path)?.inSitemap).toBe(false);
    }
    const guidesIndex = routes.find((route) => route.path === "/guides");
    expect(guidesIndex?.inSitemap).toBe(listGuides().length > 0);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < to prevent closing the script tag", () => {
    const output = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(output).not.toContain("<");
    expect(JSON.parse(output).name).toBe("</script><script>alert(1)</script>");
  });
});
