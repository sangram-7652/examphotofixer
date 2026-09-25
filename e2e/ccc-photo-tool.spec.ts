import { expect, test, type Page } from "@playwright/test";
import { readJpegFacts } from "../src/lib/image/inspect";
import { CCC_PHOTO } from "../src/lib/presets/ccc";
import { buildDownloadFilename } from "../src/lib/tools/preset-labels";
import {
  downloadBytes,
  makeImage,
  recordAnalytics,
  upload as uploadTo,
  type Pattern,
} from "./helpers";

/**
 * End-to-end: /ccc-photo-resizer on Chromium, Firefox, WebKit and a phone.
 * Test images are generated in the page (deterministic canvas patterns), then
 * handed to the file input. Waits are on UI states, never fixed delays.
 */

const PATH = "/ccc-photo-resizer";
const SIZE = `${CCC_PHOTO.width} × ${CCC_PHOTO.height} px`;
const KB = `${CCC_PHOTO.fileSizeKB.min}–${CCC_PHOTO.fileSizeKB.max} KB`;
const DPI = `${CCC_PHOTO.dpi.min}–${CCC_PHOTO.dpi.max}`;

const tool = (page: Page) => page.getByTestId("image-tool");

const upload = (page: Page, buffer: Buffer, name = "my-photo.jpg", mimeType = "image/jpeg") =>
  uploadTo(page, buffer, name, mimeType);

async function toCrop(page: Page, pattern: Pattern = "noise") {
  await upload(page, await makeImage(page, pattern, 600, 800));
  await expect(tool(page)).toHaveAttribute("data-state", "CROP");
}

/** Records every value of `data-stage` rendered by the progress UI. */
async function recordProgressStages(page: Page) {
  await page.addInitScript(() => {
    const stages: string[] = [];
    (window as unknown as { __stages: string[] }).__stages = stages;
    const record = (el: Element) => {
      const stage = el.getAttribute("data-stage");
      if (stage && stages.at(-1) !== stage) stages.push(stage);
    };
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes") record(m.target as Element);
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) node.querySelectorAll("[data-stage]").forEach(record);
          if (node instanceof Element && node.hasAttribute("data-stage")) record(node);
        });
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-stage"],
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(PATH);
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
});

test("page loads with H1, intro, FAQ and requirement values from the preset", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CCC Photo Resizer");
  const required = tool(page).getByRole("region", { name: "Required" });
  await expect(required.getByText(SIZE)).toBeVisible();
  await expect(required.getByText(KB)).toBeVisible();
  await expect(required.getByText("JPG/JPEG")).toBeVisible();
  await expect(required.getByText(DPI)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source and verification" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
});

test("source & verification cites NIELIT Version 1.11 (2023) with a safe new-tab link", async ({
  page,
}) => {
  const source = page.getByTestId("requirements-source");
  await expect(source).toContainText(
    "Requirements based on NIELIT CCC Examination Application Guidelines, Version 1.11 (2023).",
  );
  await expect(source).toContainText(`Values verified against the source on`);
  await expect(source.locator("time")).toHaveAttribute("datetime", CCC_PHOTO.source.verifiedOn!);
  await expect(source).toContainText("not affiliated with NIELIT");

  const link = source.getByRole("link", { name: /^View source/ });
  await expect(link).toHaveAttribute("href", CCC_PHOTO.source.url!);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  await expect(link).toHaveAccessibleName(/Version 1\.11 \(2023\).*opens in a new tab/);

  // Referencing the source must never read as an endorsement.
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const claim of [
    "official nielit tool",
    "nielit approved",
    "approved by nielit",
    "nielit-approved",
  ]) {
    expect(text).not.toContain(claim);
  }
  // Any sentence mentioning affiliation must be a question or a denial.
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences.filter((line) => line.includes("affiliated with nielit"))) {
    expect(sentence).toMatch(/\bnot\b|\?$/);
  }
});

test("happy path: upload → crop → real progress → READY → download → start again", async ({
  page,
}) => {
  await recordProgressStages(page);
  await recordAnalytics(page);
  await page.reload();
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");

  const nonGet: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") nonGet.push(`${request.method()} ${request.url()}`);
  });

  // Upload
  await toCrop(page);
  await expect(page.getByTestId("selected-file")).toContainText("my-photo.jpg");
  await expect(page.getByTestId("selected-file")).toContainText("KB");

  // Crop: drag, zoom, keyboard, reset
  const frame = page.getByTestId("crop-frame");
  const position = page.getByTestId("crop-position");
  const initial = await position.textContent();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("slider", { name: "Zoom" })).toHaveValue("1.25");
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect(position).not.toHaveText(initial!);
  const dragged = await position.textContent();
  await frame.focus();
  await page.keyboard.press("ArrowRight");
  await expect(position).not.toHaveText(dragged!);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(position).toHaveText(initial!);
  await page.getByRole("button", { name: "Zoom in" }).click();

  // Process
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY");
  await expect(page.getByTestId("result-heading")).toContainText("Ready to upload");

  const order = [
    "starting",
    "loading",
    "orientation",
    "cropping",
    "resizing",
    "encoding",
    "dpi",
    "metadata",
    "validation",
    "complete",
  ];
  const stages = await page.evaluate(() => (window as unknown as { __stages: string[] }).__stages);
  expect(stages.length).toBeGreaterThan(1);
  const indices = stages.map((stage) => order.indexOf(stage));
  expect(indices.every((index) => index >= 0)).toBe(true);
  expect(indices).toEqual([...indices].sort((a, b) => a - b)); // real events, in pipeline order

  // Checklist from engine validation
  const checklist = page.getByTestId("checklist");
  for (const id of ["dimensions", "file-size", "format", "dpi", "metadata"]) {
    await expect(checklist.locator(`[data-check="${id}"]`)).toHaveAttribute("data-status", "pass");
  }
  await expect(checklist.locator('[data-check="dimensions"]')).toContainText(SIZE);
  await expect(checklist.locator('[data-check="dpi"]')).toContainText("150 DPI");
  await expect(checklist.locator('[data-check="metadata"]')).toContainText("Removed");
  await expect(checklist.getByText("Dimensions: Passed.")).toBeAttached(); // not colour-only

  // Previews
  await expect(page.getByTestId("preview-original")).toContainText("600 × 800 px");
  await expect(page.getByTestId("preview-final")).toContainText(SIZE);

  // Download
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JPG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(buildDownloadFilename(CCC_PHOTO));
  const bytes = await downloadBytes(download);
  const facts = readJpegFacts(bytes)!;
  expect(facts).toMatchObject({
    width: CCC_PHOTO.width,
    height: CCC_PHOTO.height,
    format: "jpeg",
    dpi: { x: 150, y: 150 },
    metadata: [],
  });
  expect(facts.byteLength).toBeGreaterThanOrEqual(CCC_PHOTO.fileSizeKB.min * 1024);
  expect(facts.byteLength).toBeLessThanOrEqual(CCC_PHOTO.fileSizeKB.max * 1000);

  // Start again
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
  await expect(tool(page).locator("img")).toHaveCount(0);
  await toCrop(page);

  // Nothing was sent to a server.
  expect(nonGet).toEqual([]);

  const events = await page.evaluate(() => (window as unknown as { __events: string[] }).__events);
  for (const name of [
    "page_view",
    "tool_viewed",
    "image_selected",
    "processing_started",
    "processing_completed",
    "result_ready",
    "download_started",
    "download_completed",
  ]) {
    expect(events, name).toContain(name);
  }
});

test("below minimum KB: warning, not an error, and still downloadable", async ({ page }) => {
  await toCrop(page, "flat");
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY_WITH_WARNING");
  const size = page.getByTestId("checklist").locator('[data-check="file-size"]');
  await expect(size).toHaveAttribute("data-status", "warning");
  await expect(size).toContainText(`Required: ${KB}`);
  for (const id of ["dimensions", "format", "dpi"]) {
    await expect(page.locator(`[data-check="${id}"]`)).toHaveAttribute("data-status", "pass");
  }
  await expect(page.getByTestId("size-warning")).toContainText(
    "We kept the highest-quality version instead of adding artificial data.",
  );
  await expect(page.getByTestId("size-warning")).toContainText("may still enforce");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Anyway" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(buildDownloadFilename(CCC_PHOTO));
  const bytes = await downloadBytes(download);
  expect(bytes.length).toBeLessThan(CCC_PHOTO.fileSizeKB.min * 1024);
  expect(readJpegFacts(bytes)?.metadata).toEqual([]); // no padding segments
});

test("unsupported file is rejected with a friendly message", async ({ page }) => {
  await upload(page, Buffer.from("this is not an image"), "notes.jpg");
  await expect(tool(page).getByRole("alert")).toHaveText(
    "This image format isn't supported. Please choose JPG, PNG or WebP.",
  );
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
});

test("PNG upload works and produces a JPG", async ({ page }) => {
  await upload(
    page,
    await makeImage(page, "noise", 500, 500, "image/png"),
    "scan.png",
    "image/png",
  );
  await expect(tool(page)).toHaveAttribute("data-state", "CROP");
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY");
  await expect(page.locator('[data-check="format"]')).toContainText("JPG/JPEG");
});

test("damaged image shows a friendly error and can start over", async ({ page }) => {
  const jpeg = await makeImage(page, "noise", 400, 400);
  await upload(page, jpeg.subarray(0, Math.floor(jpeg.length / 3)), "broken.jpg");
  // Some browsers render partial JPEGs (→ engine rejects on processing); others refuse up front.
  const alert = tool(page).getByRole("alert");
  const frame = page.getByTestId("crop-frame");
  await expect(alert.or(frame)).toBeVisible();
  if (await frame.isVisible()) {
    await page.getByRole("button", { name: "Process photo" }).click();
    await expect(tool(page)).toHaveAttribute("data-state", "ERROR");
  }
  await expect(alert).toHaveText("We couldn't read this image. Please try another file.");
  const again = page.getByRole("button", { name: "Choose another photo" });
  if (await again.isVisible()) await again.click();
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
});

test("mobile layout: tool is in the first screen, no horizontal scroll", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone viewport only");
  const choose = page.getByRole("button", { name: "Choose photo" });
  const box = (await choose.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(box.height).toBeGreaterThanOrEqual(44); // comfortable touch target
  await expect(page.getByRole("button", { name: "Capture image" })).toBeVisible();

  const noOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
  expect(await noOverflow()).toBe(true);
  await toCrop(page);
  expect(await noOverflow()).toBe(true);
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY");
  expect(await noOverflow()).toBe(true);
  // Preview images stay above their captions (no overlap on small screens).
  for (const key of ["original", "final"]) {
    const figure = page.getByTestId(`preview-${key}`);
    const image = (await figure.locator("img").boundingBox())!;
    const caption = (await figure.locator("figcaption").boundingBox())!;
    expect(image.y + image.height, key).toBeLessThanOrEqual(caption.y + 1);
  }
});
