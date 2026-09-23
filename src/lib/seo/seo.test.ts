import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";
import { listSiteRoutes } from "./routes";

describe("site routes", () => {
  it.each(listSiteRoutes().map((route) => [route.path]))("%s has an App Router page", (path) => {
    const file = join(process.cwd(), "src/app", path, "page.tsx");
    expect(existsSync(file), file).toBe(true);
  });

  it("keeps placeholder pages out of the sitemap", () => {
    const guides = listSiteRoutes().find((route) => route.path === "/guides");
    expect(guides?.inSitemap).toBe(false);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < to prevent closing the script tag", () => {
    const output = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(output).not.toContain("<");
    expect(JSON.parse(output).name).toBe("</script><script>alert(1)</script>");
  });
});
