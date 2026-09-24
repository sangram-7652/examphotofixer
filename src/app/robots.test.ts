import { afterEach, describe, expect, it, vi } from "vitest";

async function robotsWith(indexable: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_INDEXABLE", indexable ? "true" : "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://examphotofixer.com");
  return (await import("./robots")).default();
}

afterEach(() => vi.unstubAllEnvs());

describe("robots.txt", () => {
  it("before launch: disallows everything", async () => {
    expect(await robotsWith(false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("live: allows the site, keeps the test harness out, and points at the sitemap", async () => {
    expect(await robotsWith(true)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/dev/" },
      sitemap: "https://examphotofixer.com/sitemap.xml",
    });
  });
});
