import { expect, test, type Page } from "@playwright/test";
import { readOutputFacts } from "../src/lib/image/inspect";
import {
  downloadBytes,
  hasNoHorizontalOverflow,
  makeImage,
  recordAnalytics,
  analyticsEvents,
  recordNonGetRequests,
  upload,
} from "./helpers";

const PATH = "/image-resizer";
const tool = (page: Page) => page.getByTestId("image-tool");
const width = (page: Page) => page.getByLabel("Width", { exact: true });
const height = (page: Page) => page.getByLabel("Height", { exact: true });

async function toConfigure(
  page: Page,
  buffer: Buffer,
  name = "holiday photo.jpg",
  type = "image/jpeg",
) {
  await upload(page, buffer, name, type);
  await expect(tool(page)).toHaveAttribute("data-state", "CONFIGURE");
}

/** Processing can take several seconds for large images; wait for the result state. */
const PROCESSING_TIMEOUT = { timeout: 30_000 };

async function resizeAndDownload(page: Page) {
  await page.getByRole("button", { name: "Resize Image" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY", PROCESSING_TIMEOUT);
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
  await expect(page).toHaveTitle(/^Image Resizer – Resize JPG, PNG & WebP to Custom Dimensions/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Resize JPG, PNG or WebP/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/image-resizer$/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Image Resizer/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Image Resizer");
  const visible = await page.locator("details summary").allTextContents();
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  const faq = (JSON.parse(ld!) as { "@type": string; mainEntity?: { name: string }[] }[]).find(
    (entry) => entry["@type"] === "FAQPage",
  )!;
  expect(faq.mainEntity!.map((q) => q.name)).toEqual(visible.map((text) => text.trim()));
  expect(visible).toContain("What is crop vs fit?");
  await expect(page.getByRole("link", { name: "Try the CCC image tools" })).toBeVisible();
});

test("upload shows original details; lock recalculates; crop gives exact size; download", async ({
  page,
}) => {
  await recordAnalytics(page);
  await page.reload();
  const uploads = recordNonGetRequests(page);
  await toConfigure(page, await makeImage(page, "textured", 1200, 900));

  const details = page.getByTestId("source-details");
  await expect(details).toContainText("holiday photo.jpg");
  await expect(details).toContainText("1200 px");
  await expect(details).toContainText("900 px");
  await expect(details).toContainText("JPG/JPEG");
  await expect(details).toContainText("KB");

  // Locked: width drives height.
  await width(page).fill("800");
  await expect(height(page)).toHaveValue("600");
  await height(page).fill("300");
  await expect(width(page)).toHaveValue("400");

  // Unlocked: independent, with the no-stretch explanation.
  await page.getByLabel("Lock aspect ratio").uncheck();
  await expect(page.getByText("Your image is never stretched")).toBeVisible();
  await width(page).fill("500");
  await height(page).fill("500");
  await expect(width(page)).toHaveValue("500");
  await expect(page.getByTestId("output-size")).toHaveText("Output: 500 × 500 px");
  await expect(page.getByTestId("crop-frame")).toBeVisible(); // crop mode uses the Cropper

  const file = await resizeAndDownload(page);
  expect(file.facts).toMatchObject({ width: 500, height: 500, format: "jpeg", metadata: [] });
  expect(file.name).toBe("holiday-photo-resized-500x500.jpg");
  await expect(page.getByTestId("preview-final")).toContainText("500 × 500 px");
  await expect(page.getByTestId("preview-original")).toContainText("1200 × 900 px");

  // Start again clears everything.
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
  await expect(tool(page).locator("img")).toHaveCount(0);

  expect(uploads).toEqual([]);
  const events = await analyticsEvents(page);
  for (const name of [
    "tool_open",
    "image_selected",
    "resize_settings_changed",
    "processing_started",
    "processing_completed",
    "validation_passed",
    "download_clicked",
    "download_completed",
    "tool_reset",
  ]) {
    expect(events, name).toContain(name);
  }
});

test("fit keeps the whole image inside the box without stretching or padding", async ({ page }) => {
  await toConfigure(page, await makeImage(page, "textured", 1200, 900));
  await page.getByLabel("Lock aspect ratio").uncheck();
  await width(page).fill("500");
  await height(page).fill("500");
  await page.getByLabel("Fit inside dimensions").check();
  await expect(page.getByTestId("crop-frame")).toHaveCount(0);
  await expect(page.getByTestId("output-size")).toHaveText("Output: 500 × 375 px");
  const file = await resizeAndDownload(page);
  expect(file.facts).toMatchObject({ width: 500, height: 375 });
});

test("transparent PNG defaults to PNG and keeps transparency; JPG warns first", async ({
  page,
}) => {
  await toConfigure(
    page,
    await makeImage(page, "transparent", 400, 400, "image/png"),
    "logo.png",
    "image/png",
  );
  await expect(page.getByLabel("PNG")).toBeChecked();
  await expect(page.getByRole("slider", { name: /Quality/ })).toHaveCount(0); // no JPEG-style quality for PNG

  await page.getByLabel("JPG").check();
  await expect(tool(page).getByText("JPG can't store transparency")).toBeVisible();
  await expect(page.getByRole("slider", { name: /Quality/ })).toBeVisible();

  await page.getByLabel("PNG").check();
  await width(page).fill("200");
  const file = await resizeAndDownload(page);
  expect(file.facts).toMatchObject({ width: 200, height: 200, format: "png", metadata: [] });
  expect(file.name).toBe("logo-resized-200x200.png");
  const alpha = await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>('[data-testid="preview-final"] img')!;
    const bitmap = await createImageBitmap(await (await fetch(img.src)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    return {
      corner: ctx.getImageData(2, 2, 1, 1).data[3],
      centre: ctx.getImageData(100, 100, 1, 1).data[3],
    };
  });
  expect(alpha).toEqual({ corner: 0, centre: 255 });
});

test("WebP output where supported; otherwise the option explains why", async ({ page }) => {
  await toConfigure(page, await makeImage(page, "textured", 800, 600));
  const webp = page.getByLabel("WebP");
  if (await webp.isDisabled()) {
    await expect(page.getByText("Not supported in this browser")).toBeVisible();
    return;
  }
  await webp.check();
  await width(page).fill("400");
  const file = await resizeAndDownload(page);
  expect(file.facts).toMatchObject({ width: 400, height: 300, format: "webp" });
  expect(file.name).toMatch(/-resized-400x300\.webp$/);
});

test("invalid dimensions are explained and block resizing", async ({ page }) => {
  await toConfigure(page, await makeImage(page, "textured", 800, 600));
  await width(page).fill("0");
  await expect(width(page)).toHaveValue("0");
  await expect(page.getByText("Width must be at least 1 px.")).toBeVisible();
  await expect(width(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Resize Image" })).toBeDisabled();
  await width(page).fill("20000");
  await expect(page.getByText("Width can be at most 10,000 px.")).toBeVisible();
  await width(page).fill("800");
  await expect(page.getByRole("button", { name: "Resize Image" })).toBeEnabled();
});

test("unsupported and damaged files are rejected with friendly messages", async ({ page }) => {
  await upload(page, Buffer.from("not an image"), "notes.jpg");
  await expect(tool(page).getByRole("alert")).toHaveText(
    "This image format isn't supported. Please choose JPG, PNG or WebP.",
  );
  await upload(
    page,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
    "bad.png",
  );
  await expect(tool(page).getByRole("alert")).toHaveText(
    "We couldn't read this image. Please try another file.",
  );
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
});

test("mobile: upload early, usable settings, stacked preview, no overflow", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone viewport only");
  const choose = page.getByRole("button", { name: "Choose image" });
  const box = (await choose.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await toConfigure(page, await makeImage(page, "textured", 1200, 900));
  expect((await width(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
  await width(page).fill("600");
  await page.getByRole("button", { name: "Resize Image" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY", PROCESSING_TIMEOUT);
  const original = (await page.getByTestId("preview-original").boundingBox())!;
  const final = (await page.getByTestId("preview-final").boundingBox())!;
  expect(final.y).toBeGreaterThan(original.y + original.height - 1); // stacked
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
});
