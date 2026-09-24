import { expect, test } from "@playwright/test";
import { listGuides } from "../src/content/guides";

const TOOL_PAGES = [
  { path: "/ccc-photo-resizer", h1: "CCC Photo Resizer" },
  { path: "/ccc-signature-resizer", h1: "CCC Signature Resizer" },
  { path: "/ccc-thumb-impression-resizer", h1: "CCC Left Thumb Impression Resizer" },
  { path: "/ccc-complete-pack", h1: "CCC Complete Pack" },
  { path: "/image-resizer", h1: "Image Resizer" },
  { path: "/image-compressor", h1: "Image Compressor" },
];

test("home page shows hero, exam search and tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fix your exam photo before you upload it.",
  );
  const search = page.getByRole("searchbox", { name: "Search your exam" });
  await expect(search).toBeVisible();
  await search.fill("nielit");
  await page.getByRole("link", { name: "CCC", exact: true }).click();
  await expect(page).toHaveURL(/\/ccc-complete-pack$/);
});

for (const { path, h1 } of TOOL_PAGES) {
  test(`${path} renders with canonical URL and one h1`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(h1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${path}$`),
    );
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });
}

test("CCC photo page shows requirements from the preset", async ({ page }) => {
  await page.goto("/ccc-photo-resizer");
  const table = page.getByRole("region", { name: "CCC Photo requirements" });
  await expect(table.getByText("132 × 170 pixels (width × height)")).toBeVisible();
  await expect(table.getByText("5–50 KB")).toBeVisible();
});

test("old pack URL permanently redirects to /ccc-complete-pack", async ({ request }) => {
  const response = await request.get("/ccc-image-resizer", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toBe("/ccc-complete-pack");
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/ccc-photo-resizer</loc>");
  // /guides has published guides since P7, so it and each guide are listed.
  for (const guide of ["/guides", ...listGuides().map((g) => `/guides/${g.slug}`)]) {
    expect(xml).toContain(`${guide}</loc>`);
  }
  for (const live of [
    "/ccc-photo-resizer",
    "/ccc-signature-resizer",
    "/ccc-thumb-impression-resizer",
    "/ccc-complete-pack",
  ]) {
    expect(xml).toContain(`${live}</loc>`);
  }
  for (const generic of ["/image-resizer", "/image-compressor"]) {
    expect(xml).toContain(`${generic}</loc>`);
  }
  expect((await request.get("/robots.txt")).ok()).toBe(true);
});

test("page has no horizontal scroll on mobile", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
