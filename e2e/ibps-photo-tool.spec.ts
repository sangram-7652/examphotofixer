import { expect, test, type Page } from "@playwright/test";
import { readJpegFacts } from "../src/lib/image/inspect";
import { insertExif } from "../src/lib/image/testing/exif-builder";
import { IBPS_PHOTO } from "../src/lib/presets/ibps";
import { dpiShortText } from "../src/lib/presets/describe";
import { sourceCitation } from "../src/lib/presets/source";
import { buildDownloadFilename } from "../src/lib/tools/preset-labels";
import {
  downloadBytes,
  hasNoHorizontalOverflow,
  makeImage,
  recordNonGetRequests,
  upload,
} from "./helpers";

/**
 * /ibps-photo-resizer: the first non-CCC verified preset, on the same ImageTool
 * and engine. Every expected value comes from the IBPS_PHOTO preset.
 */
const PATH = "/ibps-photo-resizer";
const P = IBPS_PHOTO;
const tool = (page: Page) => page.getByTestId("image-tool");
const PROCESSING_TIMEOUT = { timeout: 30_000 };

/** Captures full analytics payloads (to prove they never carry file data). */
async function recordAnalyticsPayloads(page: Page) {
  await page.addInitScript(() => {
    const payloads: string[] = [];
    (window as unknown as { __payloads: string[] }).__payloads = payloads;
    window.addEventListener("epf:analytics", (event) =>
      payloads.push(JSON.stringify((event as CustomEvent).detail)),
    );
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(PATH);
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
});

test("page: H1, requirements and source from the preset, live-capture limitation, no affiliation claim", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("IBPS Photo Resizer");
  const required = tool(page).getByRole("region", { name: "Required" });
  await expect(required.getByText(`${P.width} × ${P.height} px`)).toBeVisible();
  await expect(required.getByText(`${P.fileSizeKB.min}–${P.fileSizeKB.max} KB`)).toBeVisible();
  await expect(required.getByText(dpiShortText(P.dpi))).toBeVisible();
  const table = page.getByRole("region", { name: `${P.label} requirements` });
  await expect(table).toContainText("stated as preferred");
  await expect(table).toContainText("at least 200 DPI");
  await expect(table).toContainText(
    "capture and upload a photograph with a webcam or mobile phone",
  );

  const source = page.getByTestId("requirements-source");
  await expect(source).toContainText(sourceCitation(P.source));
  await expect(source).toContainText(`page ${P.source.page}`);
  await expect(source).toContainText("not affiliated with IBPS");
  await expect(source.getByRole("link", { name: /^View source/ })).toHaveAttribute(
    "href",
    P.source.url!,
  );
  await expect(
    page.getByRole("link", { name: "IBPS Photo Size: Dimensions, File Size, Format and DPI" }),
  ).toHaveAttribute("href", "/guides/ibps-photo-size");
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const claim of [
    "official ibps",
    "ibps approved",
    "approved by ibps",
    "guaranteed",
    "100% accept",
  ]) {
    expect(text).not.toContain(claim);
  }
});

test("valid photo → READY; download has exact size, bytes in range, JPEG, DPI ≥ minimum, no EXIF/GPS; nothing uploaded", async ({
  page,
}) => {
  await recordAnalyticsPayloads(page);
  await page.reload();
  const uploads = recordNonGetRequests(page);

  // A camera-style JPEG carrying GPS, camera make/model and a timestamp.
  const camera = Buffer.from(
    insertExif(new Uint8Array(await makeImage(page, "noise", 600, 800)), {
      orientation: 1,
      gps: true,
      make: "PhoneCo",
      model: "Camera X",
      dateTime: "2026:09:24 10:00:00",
    }),
  );
  await upload(page, camera, "Ravi Kumar passport.jpg");
  await expect(tool(page)).toHaveAttribute("data-state", "CROP");
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY", PROCESSING_TIMEOUT);
  for (const id of ["dimensions", "file-size", "format", "dpi", "metadata"]) {
    await expect(page.getByTestId("checklist").locator(`[data-check="${id}"]`)).toHaveAttribute(
      "data-status",
      "pass",
    );
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JPG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(buildDownloadFilename(P));
  const bytes = await downloadBytes(download);
  const facts = readJpegFacts(bytes)!;
  expect(facts).toMatchObject({ width: P.width, height: P.height, format: "jpeg", metadata: [] });
  expect(bytes.length).toBeGreaterThanOrEqual(P.fileSizeKB.min * 1024);
  expect(bytes.length).toBeLessThanOrEqual(P.fileSizeKB.max * 1000);
  expect(facts.dpi!.x).toBeGreaterThanOrEqual(P.dpi.min);
  const raw = Buffer.from(bytes).toString("latin1");
  for (const leaked of ["Exif", "PhoneCo", "Camera X", "2026:09:24"])
    expect(raw).not.toContain(leaked);

  // Privacy: no uploads; analytics never carries filenames or image data.
  expect(uploads).toEqual([]);
  const payloads = await page.evaluate(
    () => (window as unknown as { __payloads: string[] }).__payloads,
  );
  expect(payloads.length).toBeGreaterThan(3);
  for (const payload of payloads) {
    expect(payload).not.toMatch(/Ravi|passport|blob:|data:image|base64|PhoneCo|GPS/i);
    // Every event now carries route/device context too; still far below any image data.
    expect(payload.length).toBeLessThan(600);
    const { props } = JSON.parse(payload) as { props: Record<string, unknown> };
    for (const value of Object.values(props)) expect(String(value).length).toBeLessThanOrEqual(64);
  }
});

test("plain image below the minimum → warning, Download Anyway, never padded", async ({ page }) => {
  await upload(page, await makeImage(page, "flat", 600, 800), "plain.jpg");
  await expect(tool(page)).toHaveAttribute("data-state", "CROP");
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY_WITH_WARNING", PROCESSING_TIMEOUT);
  await expect(page.getByTestId("checklist").locator('[data-check="file-size"]')).toHaveAttribute(
    "data-status",
    "warning",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Anyway" }).click();
  const bytes = await downloadBytes(await downloadPromise);
  expect(bytes.length).toBeLessThan(P.fileSizeKB.min * 1024);
  expect(readJpegFacts(bytes)?.metadata).toEqual([]);
});

test("mobile: tool in first screen, no overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone viewport only");
  const box = (await page.getByRole("button", { name: "Choose photo" }).boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
});
