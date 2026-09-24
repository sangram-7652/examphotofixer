import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Search-engine view: raw server HTML fetched without a browser (no hydration),
 * for every sitemap URL. Browser-independent, so it runs in one project only.
 */
test.skip(
  ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
  "HTTP-only checks",
);

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const xml = await (await request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

const one = (html: string, pattern: RegExp) => html.match(pattern)?.[1] ?? null;
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();

test("sitemap has exactly the expected live URLs", async ({ request }) => {
  const paths = await sitemapPaths(request);
  const expected = [
    "/",
    "/tools",
    "/guides",
    "/privacy",
    "/terms",
    "/ccc-photo-resizer",
    "/ccc-signature-resizer",
    "/ccc-thumb-impression-resizer",
    "/ccc-complete-pack",
    "/image-resizer",
    "/image-compressor",
    "/guides/ccc-photo-size",
    "/guides/ccc-signature-size",
    "/guides/ccc-thumb-impression-size",
    "/guides/ccc-photo-upload-problems",
    "/ibps-photo-resizer",
    "/guides/ibps-photo-size",
  ];
  expect([...paths].sort()).toEqual([...expected].sort());
  expect(new Set(paths).size).toBe(paths.length);
});

test("every sitemap URL: 200, one canonical to itself, title, description, one H1, same robots as home, valid JSON-LD", async ({
  request,
}) => {
  const home = await (await request.get("/")).text();
  const siteRobots = one(home, /<meta name="robots" content="([^"]+)"/);
  for (const path of await sitemapPaths(request)) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    const html = await response.text();

    expect(count(html, /<link rel="canonical"/g), `${path} canonical count`).toBe(1);
    const canonical = new URL(one(html, /<link rel="canonical" href="([^"]+)"/)!);
    expect(canonical.pathname, path).toBe(path);
    expect(canonical.search, path).toBe("");
    expect(one(html, /<title>([^<]+)<\/title>/), `${path} title`).toBeTruthy();
    expect(
      one(html, /<meta name="description" content="([^"]+)"/),
      `${path} description`,
    ).toBeTruthy();
    expect(
      one(html, /<meta property="og:title" content="([^"]+)"/),
      `${path} og:title`,
    ).toBeTruthy();
    expect(count(html, /<h1[\s>]/g), `${path} h1 count`).toBe(1);
    // No page-level noindex beyond the site-wide setting.
    expect(one(html, /<meta name="robots" content="([^"]+)"/), `${path} robots`).toBe(siteRobots);

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length, `${path} JSON-LD blocks`).toBeLessThanOrEqual(1); // one block per page
    const entries = blocks.flatMap((b) => {
      const parsed = JSON.parse(b[1]);
      return Array.isArray(parsed) ? parsed : [parsed];
    }) as { "@type": string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] }[];
    const types = entries.map((e) => e["@type"]);
    expect(new Set(types).size, `${path} duplicate schema types`).toBe(types.length);
    for (const forbidden of [
      "Review",
      "AggregateRating",
      "Rating",
      "Organization",
      "GovernmentOrganization",
    ]) {
      expect(types, path).not.toContain(forbidden);
    }
    const faq = entries.find((e) => e["@type"] === "FAQPage");
    const visibleQuestions = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) =>
      decode(m[1]),
    );
    if (faq) {
      expect(
        faq.mainEntity!.map((q) => q.name),
        `${path} FAQ schema vs visible`,
      ).toEqual(visibleQuestions);
      for (const q of faq.mainEntity!) {
        expect(decode(html), `${path} answer visible`).toContain(q.acceptedAnswer.text);
      }
    } else {
      expect(visibleQuestions, `${path} FAQ without schema`).toEqual([]);
    }
    const crumbs = entries.find((e) => e["@type"] === "BreadcrumbList");
    if (crumbs) expect(html, `${path} visible breadcrumb`).toContain('aria-label="Breadcrumb"');
  }
});

test("no broken internal links on any sitemap page", async ({ request }) => {
  const links = new Set<string>();
  for (const path of await sitemapPaths(request)) {
    const html = await (await request.get(path)).text();
    for (const m of html.matchAll(/<a [^>]*href="(\/[^"#?]*)/g)) links.add(m[1]);
  }
  expect(links.size).toBeGreaterThanOrEqual(15); // sanity: the crawl found the site's pages
  for (const link of links) {
    const response = await request.get(link, { maxRedirects: 0 });
    expect(response.status(), `link ${link}`).toBe(200);
  }
  expect([...links]).not.toContain("/ccc-image-resizer");
});

test("robots.txt, redirects, trailing slashes and real 404s", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  // The e2e build is non-indexable, so everything is disallowed (see unit tests for the live rules).
  expect(robots).toContain("Disallow: /");

  const old = await request.get("/ccc-image-resizer", { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers()["location"]).toBe("/ccc-complete-pack");

  const slash = await request.get("/guides/ccc-photo-size/", { maxRedirects: 0 });
  expect(slash.status()).toBe(308);
  expect(slash.headers()["location"]).toBe("/guides/ccc-photo-size");

  for (const missing of ["/does-not-exist", "/guides/does-not-exist", "/ssc-photo-resizer"]) {
    const response = await request.get(missing, { maxRedirects: 0 });
    expect(response.status(), missing).toBe(404);
    const html = await response.text();
    expect(one(html, /<meta name="robots" content="([^"]+)"/), missing).toContain("noindex");
  }

  // The engine test harness is never indexable.
  const harness = await (await request.get("/dev/image-engine")).text();
  expect(one(harness, /<meta name="robots" content="([^"]+)"/)).toContain("noindex");
});
