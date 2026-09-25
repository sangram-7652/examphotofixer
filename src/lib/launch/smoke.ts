/**
 * Launch / post-deploy smoke check. Verifies availability and the SEO and security launch
 * gates of a running deployment over plain HTTP: robots.txt, sitemap, every sitemap URL
 * (200 without redirect, self-canonical, indexability), a real 404, the engine test harness,
 * security headers and, for a live domain, HTTP→HTTPS and www↔apex redirects.
 *
 * It never uploads or processes images; it only issues GET requests. The fetcher is injected
 * so the same checks run from the CLI (scripts/smoke-check.ts), unit tests and Playwright.
 *
 * Written without TypeScript-only runtime syntax so the CLI can run it with Node's type
 * stripping.
 */

export interface SmokeResponse {
  status: number;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  text: string;
}

/** GET without following redirects. */
export type SmokeFetcher = (url: string) => Promise<SmokeResponse>;

export interface SmokeOptions {
  /** Where requests go, e.g. http://localhost:4310 or https://examphotofixer.com. */
  baseUrl: string;
  /** The canonical production origin the pages must declare, e.g. https://examphotofixer.com. */
  canonicalOrigin: string;
  /** Launch mode (crawling allowed) vs pre-launch mode (everything noindex/disallowed). */
  indexable: boolean;
  /** The engine test harness may be served (e2e servers set ENGINE_HARNESS=1). */
  allowHarness: boolean;
  /** Also check HTTP→HTTPS and www↔apex redirects (only meaningful on the real domain). */
  hostChecks: boolean;
}

export interface SmokeCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export const REQUIRED_SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
] as const;

interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
}

export function parseRobots(text: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === "sitemap") sitemaps.push(value);
    else if (current && field === "allow") current.allow.push(value);
    else if (current && field === "disallow") current.disallow.push(value);
  }
  return { groups, sitemaps };
}

/** Robots launch gate: exact expectations for launch and pre-launch builds. */
export function checkRobots(text: string, options: SmokeOptions): SmokeCheck[] {
  const { groups, sitemaps } = parseRobots(text);
  const star = groups.find((group) => group.agents.includes("*"));
  const globalDisallow = groups.some((group) => group.disallow.includes("/"));
  if (!options.indexable) {
    return [
      {
        name: "robots: pre-launch disallows everything",
        ok: Boolean(star && star.disallow.includes("/")),
        detail: star
          ? `Disallow: ${star.disallow.join(", ") || "(none)"}`
          : "no User-agent: * group",
      },
    ];
  }
  const expectedSitemap = `${options.canonicalOrigin}/sitemap.xml`;
  return [
    {
      name: "robots: no global Disallow: /",
      ok: !globalDisallow,
      detail: globalDisallow ? "a group disallows /" : "ok",
    },
    {
      name: "robots: User-agent: * allows /",
      ok: Boolean(star && star.allow.includes("/")),
      detail: star ? `Allow: ${star.allow.join(", ") || "(none)"}` : "no User-agent: * group",
    },
    {
      name: "robots: /dev/ disallowed",
      ok: Boolean(star && star.disallow.includes("/dev/")),
      detail: star ? `Disallow: ${star.disallow.join(", ") || "(none)"}` : "no User-agent: * group",
    },
    {
      name: "robots: sitemap on the canonical origin",
      ok: sitemaps.length === 1 && sitemaps[0] === expectedSitemap,
      detail: `found ${sitemaps.join(", ") || "none"}; expected ${expectedSitemap}`,
    },
  ];
}

export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) =>
    match[1].replace(/&amp;/g, "&"),
  );
}

/** Sitemap gate: canonical HTTPS origin, no local/dev/query/duplicate URLs. */
export function checkSitemapUrls(urls: readonly string[], options: SmokeOptions): SmokeCheck[] {
  const problems: string[] = [];
  const canonical = new URL(options.canonicalOrigin);
  for (const value of urls) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      problems.push(`not a URL: ${value}`);
      continue;
    }
    if (url.protocol !== "https:") problems.push(`not HTTPS: ${value}`);
    if (url.host !== canonical.host) problems.push(`wrong host: ${value}`);
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname)) {
      problems.push(`local URL: ${value}`);
    }
    if (url.search || url.hash) problems.push(`query or fragment: ${value}`);
    if (url.pathname.startsWith("/dev/")) problems.push(`development route: ${value}`);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      problems.push(`trailing slash: ${value}`);
    }
  }
  const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
  if (duplicates.length > 0) problems.push(`duplicates: ${[...new Set(duplicates)].join(", ")}`);
  return [
    { name: "sitemap: has URLs", ok: urls.length > 0, detail: `${urls.length} URLs` },
    {
      name: "sitemap: canonical HTTPS URLs only",
      ok: problems.length === 0,
      detail: problems.join("; ") || "ok",
    },
  ];
}

function metaContent(html: string, attribute: string, name: string): string[] {
  const values: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    if (!new RegExp(`${attribute}="${name}"`).test(tag)) continue;
    const content = /content="([^"]*)"/.exec(tag);
    if (content) values.push(content[1].replace(/&amp;/g, "&"));
  }
  return values;
}

function canonicalLinks(html: string): string[] {
  const values: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    if (!/rel="canonical"/.test(tag)) continue;
    const href = /href="([^"]*)"/.exec(tag);
    if (href) values.push(href[1].replace(/&amp;/g, "&"));
  }
  return values;
}

/** Page gate: exactly one self-canonical on the canonical origin; indexability matches mode. */
export function checkPage(html: string, canonicalUrl: string, options: SmokeOptions): string[] {
  const problems: string[] = [];
  const canonicals = canonicalLinks(html);
  if (canonicals.length !== 1) problems.push(`${canonicals.length} canonical links`);
  else if (canonicals[0] !== canonicalUrl) problems.push(`canonical ${canonicals[0]}`);
  const ogUrl = metaContent(html, "property", "og:url");
  if (ogUrl.length > 0 && !ogUrl[0].startsWith(options.canonicalOrigin)) {
    problems.push(`og:url ${ogUrl[0]}`);
  }
  const robots = metaContent(html, "name", "robots").join(",").toLowerCase();
  const noindex = robots.includes("noindex");
  if (options.indexable && noindex) problems.push(`robots meta "${robots}"`);
  if (!options.indexable && !noindex) problems.push("pre-launch page is indexable");
  if (/localhost|127\.0\.0\.1/.test(html)) problems.push("mentions localhost");
  return problems;
}

export function checkSecurityHeaders(headers: Record<string, string>): SmokeCheck {
  const missing = REQUIRED_SECURITY_HEADERS.filter((name) => !headers[name]);
  const csp = headers["content-security-policy"] ?? "";
  const connect = /connect-src ([^;]*)/.exec(csp)?.[1].trim();
  const problems = [...missing.map((name) => `missing ${name}`)];
  if (csp && connect !== "'self' blob:") problems.push(`connect-src is "${connect ?? "(unset)"}"`);
  if (/unsafe-eval/.test(csp)) problems.push("CSP allows unsafe-eval");
  return {
    name: "security headers present (CSP connect-src 'self' blob:)",
    ok: problems.length === 0,
    detail: problems.join("; ") || "ok",
  };
}

function toBase(url: string, options: SmokeOptions): string {
  const parsed = new URL(url);
  return `${options.baseUrl.replace(/\/+$/, "")}${parsed.pathname}${parsed.search}`;
}

async function safeFetch(fetcher: SmokeFetcher, url: string): Promise<SmokeResponse | string> {
  try {
    return await fetcher(url);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function runSmokeCheck(
  fetcher: SmokeFetcher,
  options: SmokeOptions,
): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = [];
  const base = options.baseUrl.replace(/\/+$/, "");

  const home = await safeFetch(fetcher, `${base}/`);
  if (typeof home === "string" || home.status !== 200) {
    checks.push({
      name: "home page: 200",
      ok: false,
      detail: typeof home === "string" ? home : `status ${home.status}`,
    });
    return checks; // Nothing else is meaningful if the site is down.
  }
  checks.push({ name: "home page: 200", ok: true, detail: "ok" });
  checks.push(checkSecurityHeaders(home.headers));

  const robots = await safeFetch(fetcher, `${base}/robots.txt`);
  if (typeof robots === "string" || robots.status !== 200) {
    checks.push({ name: "robots.txt: 200", ok: false, detail: String(robots) });
  } else {
    checks.push(...checkRobots(robots.text, options));
  }

  const sitemap = await safeFetch(fetcher, `${base}/sitemap.xml`);
  const urls =
    typeof sitemap === "string" || sitemap.status !== 200 ? [] : parseSitemap(sitemap.text);
  checks.push(...checkSitemapUrls(urls, options));

  const pageProblems: string[] = [];
  for (const url of urls) {
    const response = await safeFetch(fetcher, toBase(url, options));
    if (typeof response === "string") {
      pageProblems.push(`${url}: ${response}`);
    } else if (response.status !== 200) {
      pageProblems.push(`${url}: status ${response.status}`);
    } else {
      for (const problem of checkPage(response.text, url, options)) {
        pageProblems.push(`${url}: ${problem}`);
      }
    }
  }
  checks.push({
    name: "sitemap pages: 200, self-canonical, indexability matches mode",
    ok: urls.length > 0 && pageProblems.length === 0,
    detail: pageProblems.join("; ") || `${urls.length} pages ok`,
  });

  const missing = await safeFetch(fetcher, `${base}/this-page-does-not-exist`);
  checks.push({
    name: "unknown URL: real 404",
    ok: typeof missing !== "string" && missing.status === 404,
    detail: typeof missing === "string" ? missing : `status ${missing.status}`,
  });

  const harness = await safeFetch(fetcher, `${base}/dev/image-engine`);
  const harnessStatus = typeof harness === "string" ? 0 : harness.status;
  checks.push({
    name: options.allowHarness ? "engine harness: noindex" : "engine harness: not served (404)",
    ok: options.allowHarness
      ? typeof harness !== "string" && /noindex/.test(harness.text)
      : harnessStatus === 404,
    detail: `status ${harnessStatus || String(harness)}`,
  });

  if (options.hostChecks) checks.push(...(await checkHosts(fetcher, options)));
  return checks;
}

/** HTTP→HTTPS and www↔apex: each alternate must redirect straight to the canonical URL. */
async function checkHosts(fetcher: SmokeFetcher, options: SmokeOptions): Promise<SmokeCheck[]> {
  const canonical = new URL(options.canonicalOrigin);
  const alternateHost = canonical.hostname.startsWith("www.")
    ? canonical.hostname.slice(4)
    : `www.${canonical.hostname}`;
  const cases = [
    `http://${canonical.host}/tools`,
    `https://${alternateHost}/tools`,
    `http://${alternateHost}/tools`,
  ];
  const checks: SmokeCheck[] = [];
  for (const url of cases) {
    const response = await safeFetch(fetcher, url);
    const location = typeof response === "string" ? "" : (response.headers["location"] ?? "");
    const target = location ? new URL(location, url).toString() : "";
    const ok =
      typeof response !== "string" &&
      [301, 308].includes(response.status) &&
      target === `${options.canonicalOrigin}/tools`;
    checks.push({
      name: `redirect: ${url}`,
      ok,
      detail:
        typeof response === "string" ? response : `status ${response.status} → ${target || "-"}`,
    });
  }
  return checks;
}

export function formatSmokeReport(checks: readonly SmokeCheck[]): string {
  const lines = checks.map(
    (check) => `${check.ok ? "PASS" : "FAIL"}  ${check.name}  (${check.detail})`,
  );
  const failed = checks.filter((check) => !check.ok).length;
  lines.push(
    "",
    failed === 0 ? `All ${checks.length} checks passed.` : `${failed} check(s) failed.`,
  );
  return lines.join("\n");
}
