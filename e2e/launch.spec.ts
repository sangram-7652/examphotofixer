import { expect, test, type Page } from "@playwright/test";
import { runSmokeCheck, type SmokeFetcher } from "../src/lib/launch/smoke";
import { downloadBytes, makeImage, upload } from "./helpers";

/**
 * Launch gates on the served production build (P10).
 *
 * The same checks as `npm run smoke` run here against the e2e server. The mode follows the
 * build: the default e2e build is pre-launch (robots Disallow: /, noindex everywhere); a build
 * made with NEXT_PUBLIC_SITE_INDEXABLE=true is checked with E2E_LAUNCH=1 (robots allows /,
 * sitemap on the canonical origin, /dev/ disallowed, no noindex). See docs/TESTING.md.
 */

const LAUNCH = process.env.E2E_LAUNCH === "1";
const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://examphotofixer.com").replace(
  /\/+$/,
  "",
);
const PROCESSING_TIMEOUT = { timeout: 30_000 };

test(`smoke gate (${LAUNCH ? "launch" : "pre-launch"} build): robots, sitemap, canonicals, 404, headers`, async ({
  request,
  baseURL,
  browserName,
  isMobile,
}) => {
  test.skip(browserName !== "chromium" || isMobile, "HTTP-only checks");
  const fetcher: SmokeFetcher = async (url) => {
    const response = await request.get(url, { maxRedirects: 0 });
    return { status: response.status(), headers: response.headers(), text: await response.text() };
  };
  const checks = await runSmokeCheck(fetcher, {
    baseUrl: baseURL!,
    canonicalOrigin: ORIGIN,
    indexable: LAUNCH,
    allowHarness: true, // the e2e server sets ENGINE_HARNESS=1; production must not (npm run smoke)
    hostChecks: false, // needs the real domain
  });
  expect(checks.filter((check) => !check.ok)).toEqual([]);
  if (LAUNCH) {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  }
});

/**
 * Collects Content-Security-Policy violations across navigations: DOM violation events are
 * reported to the test process, and the browser's own CSP console messages are kept too.
 */
async function recordCspViolations(page: Page) {
  const violations: string[] = [];
  await page.exposeFunction("__reportCsp", (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) =>
      (window as unknown as { __reportCsp: (text: string) => void }).__reportCsp(
        `${event.violatedDirective} ${event.blockedURI}`,
      ),
    );
  });
  page.on("console", (message) => {
    if (/Content[- ]Security[- ]Policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

test("CSP: every tool type processes and downloads locally with no policy violation", async ({
  page,
  browserName,
}) => {
  test.slow(browserName === "webkit", "Slow image encoding in headless WebKit");
  const violations = await recordCspViolations(page);

  const response = await page.goto("/ccc-photo-resizer");
  const csp = response!.headers()["content-security-policy"];
  expect(csp).toContain("connect-src 'self' blob:;");
  expect(csp).toContain("worker-src 'self'");
  expect(csp).not.toContain("unsafe-eval");

  // Preset tool: worker, blob preview, blob download.
  await upload(page, await makeImage(page, "noise", 600, 800));
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(page.getByTestId("image-tool")).toHaveAttribute(
    "data-state",
    "READY",
    PROCESSING_TIMEOUT,
  );
  let download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JPG" }).click();
  expect((await downloadBytes(await download)).length).toBeGreaterThan(0);

  // Generic tool.
  await page.goto("/image-compressor");
  await upload(page, await makeImage(page, "textured", 800, 600));
  await page.getByLabel("100 KB").check();
  await page.getByRole("button", { name: "Compress Image" }).click();
  await expect(page.getByTestId("image-tool")).toHaveAttribute(
    "data-state",
    "SUCCESS",
    PROCESSING_TIMEOUT,
  );
  download = page.waitForEvent("download");
  await page.getByRole("link", { name: /^Download/ }).click();
  expect((await downloadBytes(await download)).length).toBeGreaterThan(0);

  // Guide page (server-rendered, JSON-LD) and home.
  await page.goto("/guides/ibps-photo-size");
  await page.goto("/");

  expect(violations).toEqual([]);
  // /privacy says no cookies are used: nothing set after browsing, processing and downloading.
  expect(await page.context().cookies()).toEqual([]);
});

test("privacy page states only what is implemented", async ({ page }) => {
  await page.goto("/privacy");
  const text = await page.getByRole("article").innerText();
  expect(text).toContain("not uploaded");
  expect(text).toContain("not sent to any analytics service");
  expect(text).toContain("no cookies are used");
  // No claim the site can't back up.
  expect(text).not.toMatch(/contact listed on this site|completely anonymous|we collect no data/i);
});
