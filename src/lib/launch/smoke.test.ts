import { describe, expect, it } from "vitest";
import {
  checkPage,
  checkRobots,
  checkSecurityHeaders,
  checkSitemapUrls,
  parseRobots,
  parseSitemap,
  runSmokeCheck,
  type SmokeFetcher,
  type SmokeOptions,
  type SmokeResponse,
} from "./smoke";
import { securityHeaders } from "@/config/security-headers";

const ORIGIN = "https://examphotofixer.com";
const LAUNCH: SmokeOptions = {
  baseUrl: "http://localhost:4310",
  canonicalOrigin: ORIGIN,
  indexable: true,
  allowHarness: false,
  hostChecks: false,
};
const PRELAUNCH: SmokeOptions = { ...LAUNCH, indexable: false };

const LIVE_ROBOTS = `User-Agent: *\nAllow: /\nDisallow: /dev/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
const HEADERS = Object.fromEntries(
  securityHeaders(false).map((h) => [h.key.toLowerCase(), h.value]),
);

const page = (path: string, robots = "index, follow") =>
  `<html><head><meta name="robots" content="${robots}"/><link rel="canonical" href="${ORIGIN}${path}"/>` +
  `<meta property="og:url" content="${ORIGIN}${path}"/></head><body><h1>x</h1></body></html>`;

describe("robots gate", () => {
  it("parses groups and sitemaps", () => {
    expect(parseRobots(LIVE_ROBOTS)).toEqual({
      groups: [{ agents: ["*"], allow: ["/"], disallow: ["/dev/"] }],
      sitemaps: [`${ORIGIN}/sitemap.xml`],
    });
  });

  it("passes the production rules", () => {
    expect(checkRobots(LIVE_ROBOTS, LAUNCH).every((check) => check.ok)).toBe(true);
  });

  it("fails an accidental global Disallow in launch mode", () => {
    const failed = checkRobots("User-agent: *\nDisallow: /\n", LAUNCH).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual([
      "robots: no global Disallow: /",
      "robots: User-agent: * allows /",
      "robots: /dev/ disallowed",
      "robots: sitemap on the canonical origin",
    ]);
  });

  it("fails a sitemap on another host (e.g. a preview URL)", () => {
    const robots = LIVE_ROBOTS.replace(ORIGIN, "https://preview.example.vercel.app");
    expect(checkRobots(robots, LAUNCH).find((c) => !c.ok)?.name).toBe(
      "robots: sitemap on the canonical origin",
    );
  });

  it("pre-launch: requires the global Disallow", () => {
    expect(checkRobots("User-agent: *\nDisallow: /\n", PRELAUNCH)[0].ok).toBe(true);
    expect(checkRobots(LIVE_ROBOTS, PRELAUNCH)[0].ok).toBe(false);
  });
});

describe("sitemap gate", () => {
  it("accepts canonical HTTPS URLs", () => {
    const urls = parseSitemap(
      `<urlset><url><loc>${ORIGIN}</loc></url><url><loc>${ORIGIN}/tools</loc></url></urlset>`,
    );
    expect(urls).toEqual([ORIGIN, `${ORIGIN}/tools`]);
    expect(checkSitemapUrls(urls, LAUNCH).every((check) => check.ok)).toBe(true);
  });

  it.each([
    ["http://examphotofixer.com/tools", "not HTTPS"],
    ["https://www.examphotofixer.com/tools", "wrong host"],
    ["https://localhost:3000/tools", "local URL"],
    [`${ORIGIN}/tools?ref=x`, "query or fragment"],
    [`${ORIGIN}/dev/image-engine`, "development route"],
    [`${ORIGIN}/tools/`, "trailing slash"],
  ])("rejects %s (%s)", (url, problem) => {
    expect(checkSitemapUrls([url], LAUNCH)[1].detail).toContain(problem);
  });

  it("rejects duplicates and an empty sitemap", () => {
    expect(checkSitemapUrls([ORIGIN, ORIGIN], LAUNCH)[1].detail).toContain("duplicates");
    expect(checkSitemapUrls([], LAUNCH)[0].ok).toBe(false);
  });
});

describe("page gate", () => {
  it("accepts a self-canonical, indexable page in launch mode", () => {
    expect(checkPage(page("/tools"), `${ORIGIN}/tools`, LAUNCH)).toEqual([]);
  });

  it("flags noindex in launch mode and indexable pages before launch", () => {
    expect(checkPage(page("/tools", "noindex, nofollow"), `${ORIGIN}/tools`, LAUNCH)).toEqual([
      'robots meta "noindex, nofollow"',
    ]);
    expect(checkPage(page("/tools"), `${ORIGIN}/tools`, PRELAUNCH)).toEqual([
      "pre-launch page is indexable",
    ]);
  });

  it("flags wrong or missing canonicals and localhost leaks", () => {
    expect(checkPage(page("/guides"), `${ORIGIN}/tools`, LAUNCH)[0]).toMatch(/^canonical /);
    expect(checkPage("<html></html>", `${ORIGIN}/tools`, LAUNCH)[0]).toBe("0 canonical links");
    expect(
      checkPage(page("/tools") + "http://localhost:3000", `${ORIGIN}/tools`, LAUNCH),
    ).toContain("mentions localhost");
  });
});

const GA_HEADERS = Object.fromEntries(
  securityHeaders(false, true).map((h) => [h.key.toLowerCase(), h.value]),
);

describe("security headers gate", () => {
  it("passes the configured headers", () => {
    expect(checkSecurityHeaders(HEADERS)).toMatchObject({ ok: true });
  });

  it("passes when GA4's own origins widen connect-src", () => {
    expect(checkSecurityHeaders(GA_HEADERS)).toMatchObject({ ok: true });
  });

  it("fails missing headers and a widened connect-src", () => {
    const widened = {
      ...HEADERS,
      "content-security-policy": HEADERS["content-security-policy"].replace(
        "connect-src 'self'",
        "connect-src 'self' https://analytics.example",
      ),
    };
    expect(checkSecurityHeaders(widened).detail).toContain("connect-src");
    const missing = Object.fromEntries(
      Object.entries(HEADERS).filter(([name]) => name !== "x-frame-options"),
    );
    expect(checkSecurityHeaders(missing).detail).toBe("missing x-frame-options");
  });
});

describe("runSmokeCheck", () => {
  function site(overrides: Record<string, Partial<SmokeResponse>> = {}): SmokeFetcher {
    const routes: Record<string, SmokeResponse> = {
      "/": { status: 200, headers: HEADERS, text: page("") },
      "/robots.txt": { status: 200, headers: {}, text: LIVE_ROBOTS },
      "/sitemap.xml": {
        status: 200,
        headers: {},
        text: `<urlset><url><loc>${ORIGIN}/tools</loc></url></urlset>`,
      },
      "/tools": { status: 200, headers: HEADERS, text: page("/tools") },
    };
    return async (url) => {
      const { pathname } = new URL(url);
      const response = routes[pathname] ?? { status: 404, headers: {}, text: "not found" };
      return { ...response, ...overrides[pathname] };
    };
  }

  it("passes a healthy launch build", async () => {
    const checks = await runSmokeCheck(site(), LAUNCH);
    expect(checks.filter((check) => !check.ok)).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(9);
  });

  it("fails a served engine harness in production", async () => {
    const checks = await runSmokeCheck(
      site({ "/dev/image-engine": { status: 200, text: "noindex" } }),
      LAUNCH,
    );
    expect(checks.filter((c) => !c.ok).map((c) => c.name)).toEqual([
      "engine harness: not served (404)",
    ]);
  });

  it("stops early and fails when the site is down", async () => {
    const down: SmokeFetcher = async () => {
      throw new Error("ECONNREFUSED");
    };
    expect(await runSmokeCheck(down, LAUNCH)).toEqual([
      { name: "home page: 200", ok: false, detail: "ECONNREFUSED" },
    ]);
  });

  it("checks HTTP→HTTPS and www→apex redirects go straight to the canonical URL", async () => {
    const healthy = site();
    const redirects: SmokeFetcher = async (url) => {
      const { protocol, host } = new URL(url);
      if (protocol === "https:" && host === "examphotofixer.com") return healthy(url);
      if (url.startsWith("http://localhost")) return healthy(url);
      return { status: 308, headers: { location: `${ORIGIN}/tools` }, text: "" };
    };
    const checks = await runSmokeCheck(redirects, { ...LAUNCH, hostChecks: true });
    expect(checks.filter((c) => c.name.startsWith("redirect:")).every((c) => c.ok)).toBe(true);

    const chained: SmokeFetcher = async (url) =>
      url.startsWith("http://www.")
        ? { status: 308, headers: { location: "https://www.examphotofixer.com/tools" }, text: "" }
        : redirects(url);
    const chainChecks = await runSmokeCheck(chained, { ...LAUNCH, hostChecks: true });
    expect(chainChecks.find((c) => !c.ok)?.name).toBe(
      "redirect: http://www.examphotofixer.com/tools",
    );
  });
});
