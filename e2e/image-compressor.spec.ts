import { expect, test, type Page } from "@playwright/test";
import { readOutputFacts } from "../src/lib/image/inspect";
import {
  analyticsEvents,
  downloadBytes,
  hasNoHorizontalOverflow,
  makeImage,
  recordAnalytics,
  recordNonGetRequests,
  upload,
} from "./helpers";

const PATH = "/image-compressor";
const tool = (page: Page) => page.getByTestId("image-tool");

async function toConfigure(page: Page, buffer: Buffer, name = "scan.jpg") {
  await upload(page, buffer, name);
  await expect(tool(page)).toHaveAttribute("data-state", "CONFIGURE");
}

/** Processing can take several seconds for large images (up to 8 encodes); wait for a result state. */
const PROCESSING_TIMEOUT = { timeout: 30_000 };

async function compress(page: Page) {
  await page.getByRole("button", { name: "Compress Image" }).click();
  await expect(tool(page)).toHaveAttribute(
    "data-state",
    /^(SUCCESS|LIMIT_NOT_REACHED|LARGER_THAN_ORIGINAL|INVALID)$/,
    PROCESSING_TIMEOUT,
  );
}

async function statBytes(page: Page, label: "Before" | "After") {
  const value = page
    .getByTestId("compression-stats")
    .locator("div", { hasText: label })
    .locator("dd");
  return Number(await value.getAttribute("data-bytes"));
}

async function downloadResult(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download" }).click();
  const download = await downloadPromise;
  const bytes = await downloadBytes(download);
  return { name: download.suggestedFilename(), bytes, facts: readOutputFacts(bytes)! };
}

test.beforeEach(async ({ page, browserName }) => {
  // Headless WebKit encodes JPEG/PNG several times slower than Chromium (see P5 pack tests);
  // tests that process large images several times get a longer budget there. Assertions unchanged.
  test.slow(browserName === "webkit", "Slow image encoding in headless WebKit");
  await page.goto(PATH);
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
});

test("page: title, description, canonical, OG, one H1, FAQ matches its structured data", async ({
  page,
}) => {
  await expect(page).toHaveTitle(/^Image Compressor – Compress JPG, PNG & WebP/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /maximum file size/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/image-compressor$/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Image Compressor/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Image Compressor");
  const visible = await page.locator("details summary").allTextContents();
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  const faq = (JSON.parse(ld!) as { "@type": string; mainEntity?: { name: string }[] }[]).find(
    (entry) => entry["@type"] === "FAQPage",
  )!;
  expect(faq.mainEntity!.map((q) => q.name)).toEqual(visible.map((text) => text.trim()));
  expect(visible).toContain("Can I compress an image to 100 KB?");
  await expect(page.getByRole("link", { name: "Use the CCC Photo Resizer" })).toBeVisible();
});

test("200 KB preset: downloaded file ≤ 200 × 1024 bytes, dimensions preserved, stats from real bytes", async ({
  page,
}) => {
  await recordAnalytics(page);
  await page.reload();
  const uploads = recordNonGetRequests(page);
  const input = await makeImage(page, "textured", 1600, 1200, "image/jpeg", 0.98);
  await toConfigure(page, input, "Family Trip.jpg");
  await expect(page.getByLabel("200 KB")).toBeChecked(); // default
  await expect(page.getByTestId("dimensions-note")).toHaveText(
    "Dimensions preserved: 1600 × 1200 px",
  );
  await expect(page.getByRole("link", { name: "Use Image Resizer" })).toHaveAttribute(
    "href",
    "/image-resizer",
  );

  await compress(page);
  await expect(tool(page)).toHaveAttribute("data-state", "SUCCESS");
  const file = await downloadResult(page);

  // The critical rule, on the actual downloaded bytes.
  expect(file.bytes.length).toBeLessThanOrEqual(200 * 1024);
  expect(file.facts).toMatchObject({ width: 1600, height: 1200, format: "jpeg", metadata: [] });
  expect(file.name).toBe("family-trip-compressed.jpg");

  const before = await statBytes(page, "Before");
  const after = await statBytes(page, "After");
  expect(before).toBe(input.length);
  expect(after).toBe(file.bytes.length);
  const expected = (((before - after) / before) * 100).toFixed(1);
  await expect(page.getByTestId("saved-percent")).toHaveText(`${expected}%`);

  expect(uploads).toEqual([]);
  const events = await analyticsEvents(page);
  for (const name of [
    "tool_open",
    "image_selected",
    "processing_started",
    "processing_completed",
    "validation_passed",
    "download_clicked",
    "download_completed",
  ]) {
    expect(events, name).toContain(name);
  }
});

test("100 KB preset and a custom maximum are enforced on the downloaded bytes", async ({
  page,
}) => {
  const input = await makeImage(page, "textured", 1600, 1200, "image/jpeg", 0.98);
  await toConfigure(page, input);
  await page.getByLabel("100 KB").check();
  await compress(page);
  await expect(tool(page)).toHaveAttribute("data-state", "SUCCESS");
  expect((await downloadResult(page)).bytes.length).toBeLessThanOrEqual(100 * 1024);

  await page.getByRole("button", { name: "Change settings" }).click();
  await page.getByLabel("Custom", { exact: true }).check();
  const custom = page.getByLabel("Custom maximum (KB)");
  await custom.fill("5");
  await expect(page.getByText("The maximum must be at least 10 KB.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compress Image" })).toBeDisabled();
  await custom.fill("150");
  await compress(page);
  await expect(tool(page)).toHaveAttribute("data-state", "SUCCESS");
  expect((await downloadResult(page)).bytes.length).toBeLessThanOrEqual(150 * 1024);
});

test("impossible limit: clear state, no download, recovery actions", async ({ page }) => {
  await toConfigure(page, await makeImage(page, "noise", 1500, 1500));
  await page.getByLabel("100 KB").check();
  await compress(page);
  await expect(tool(page)).toHaveAttribute("data-state", "LIMIT_NOT_REACHED");
  await expect(page.getByTestId("result-heading")).toHaveText(
    "Could not compress this image below the selected size limit.",
  );
  expect(await statBytes(page, "After")).toBeGreaterThan(100 * 1024);
  await expect(page.getByRole("link", { name: "Download" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Resize image instead" })).toHaveAttribute(
    "href",
    "/image-resizer",
  );
  await page.getByRole("button", { name: "Choose a larger limit" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "CONFIGURE");
});

test("output larger than the original is not presented as success", async ({ page }) => {
  // Already heavily compressed: any re-encode at an acceptable quality is bigger.
  const input = await makeImage(page, "noise", 400, 400, "image/jpeg", 0.05);
  await toConfigure(page, input);
  await page.getByLabel("1 MB").check();
  await compress(page);
  await expect(tool(page)).toHaveAttribute("data-state", "LARGER_THAN_ORIGINAL");
  await expect(page.getByTestId("result-heading")).toHaveText(
    "Output is larger than the original.",
  );
  expect(await statBytes(page, "After")).toBeGreaterThanOrEqual(input.length);
  await expect(page.getByTestId("saved-percent")).toContainText("larger");
  await expect(page.getByRole("link", { name: "Download" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change settings" })).toBeVisible();
});

test("image above the browser's safe limit is resized for processing, and says so", async ({
  page,
}) => {
  test.slow(); // 20-megapixel input
  // 5000 × 4000 = 20 MP > 16,777,216 px (MAX_CANVAS_PIXELS): the only case dimensions change.
  await toConfigure(
    page,
    await makeImage(page, "textured", 5000, 4000, "image/jpeg", 0.9),
    "big.jpg",
  );
  const note = page.getByTestId("dimensions-note");
  await expect(note).toContainText("Dimensions reduced to");
  await expect(note).toContainText("processing limit");
  const [, planned] = /reduced to (\d+ × \d+) px/.exec((await note.textContent())!)!;

  await page.getByLabel("1 MB").check();
  await compress(page);
  await expect(tool(page)).toHaveAttribute("data-state", "SUCCESS");
  await expect(page.getByTestId("resized-for-processing")).toContainText(
    "This image was resized for processing: 5000 × 4000 px",
  );
  await expect(page.getByTestId("resized-for-processing")).toContainText(`output is ${planned} px`);
  await expect(page.getByTestId("preview-final")).toContainText(`${planned} px`);
  await expect(tool(page).getByText("Dimensions preserved")).toHaveCount(0);

  // The downloaded file really has those dimensions, within the limit, same proportions.
  const file = await downloadResult(page);
  const [w, h] = planned.split(" × ").map(Number);
  expect(file.facts).toMatchObject({ width: w, height: h });
  expect(w * h).toBeLessThanOrEqual(16_777_216);
  expect(w / h).toBeCloseTo(5000 / 4000, 2);
  expect(file.bytes.length).toBeLessThanOrEqual(1024 * 1024);
});

test("start again clears the result; unsupported input is rejected", async ({ page }) => {
  await toConfigure(page, await makeImage(page, "textured", 800, 600));
  await compress(page);
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
  await expect(tool(page).locator("img")).toHaveCount(0);
  await upload(page, Buffer.alloc(0), "empty.jpg");
  await expect(tool(page).getByRole("alert")).toHaveText(
    "We couldn't read this image. Please try another file.",
  );
  await upload(page, Buffer.from("GIF89a....."), "anim.gif");
  await expect(tool(page).getByRole("alert")).toHaveText(
    "This image format isn't supported. Please choose JPG, PNG or WebP.",
  );
});

test("mobile: upload early, presets tappable, stacked preview, no overflow", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone viewport only");
  const choose = page.getByRole("button", { name: "Choose image" });
  const box = (await choose.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await toConfigure(page, await makeImage(page, "textured", 1600, 1200, "image/jpeg", 0.98));
  const preset = (await page.getByLabel("500 KB").locator("..").boundingBox())!;
  expect(preset.height).toBeGreaterThanOrEqual(44);
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
  await compress(page);
  const original = (await page.getByTestId("preview-original").boundingBox())!;
  const final = (await page.getByTestId("preview-final").boundingBox())!;
  expect(final.y).toBeGreaterThan(original.y + original.height - 1);
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
});
