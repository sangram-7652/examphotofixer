import { expect, test, type Locator, type Page } from "@playwright/test";
import { readJpegFacts } from "../src/lib/image/inspect";
import { CCC_LEFT_THUMB, CCC_PHOTO, CCC_SIGNATURE } from "../src/lib/presets/ccc";
import type { ImagePreset } from "../src/lib/presets/types";
import { buildDownloadFilename, buildPackFilename } from "../src/lib/tools/preset-labels";
import { readZip } from "../src/lib/zip/testing/read-zip";
import {
  analyticsEvents,
  analyticsPayloads,
  downloadBytes,
  hasNoHorizontalOverflow,
  makeImage,
  recordAnalytics,
  recordNonGetRequests,
  upload,
  type Pattern,
} from "./helpers";

const PATH = "/ccc-complete-pack";
const PRESETS = [CCC_PHOTO, CCC_SIGNATURE, CCC_LEFT_THUMB];
const NOUNS: Record<string, string> = {
  "ccc-photo": "photo",
  "ccc-signature": "signature",
  "ccc-left-thumb": "thumb impression",
};

const pack = (page: Page) => page.getByTestId("pack-tool");
const asset = (page: Page, preset: ImagePreset) => page.getByTestId(`pack-asset-${preset.id}`);
const assetTool = (page: Page, preset: ImagePreset) =>
  asset(page, preset).getByTestId("image-tool");
const statusRow = (page: Page, preset: ImagePreset) =>
  page.getByTestId("pack-status").locator(`[data-asset="${preset.id}"]`);

async function processAsset(page: Page, preset: ImagePreset, pattern: Pattern) {
  const section = asset(page, preset);
  const [w, h] = preset.width < preset.height ? [600, 800] : [800, 600];
  await upload(section, await makeImage(page, pattern, w, h), `${preset.id}.jpg`);
  await expect(assetTool(page, preset)).toHaveAttribute("data-state", "CROP");
  await expect(statusRow(page, preset)).toHaveAttribute("data-state", "SELECTED");
  await section.getByRole("button", { name: `Process ${NOUNS[preset.id]}` }).click();
  await expect(assetTool(page, preset)).toHaveAttribute(
    "data-state",
    /^(READY|READY_WITH_WARNING)$/,
  );
}

async function individualDownload(page: Page, section: Locator) {
  const downloadPromise = page.waitForEvent("download");
  await section.getByRole("link", { name: /^Download (JPG|Anyway)$/ }).click();
  const download = await downloadPromise;
  return { name: download.suggestedFilename(), bytes: await downloadBytes(download) };
}

test.beforeEach(async ({ page, browserName }) => {
  // Pack tests process three images. The headless Linux WebKit build encodes JPEGs
  // ~6× slower than Chromium (≈1.5 s per image alone, more with 4 parallel workers),
  // so give WebKit a longer time budget. Assertions are unchanged.
  test.slow(
    browserName === "webkit",
    "Three images per test; slow JPEG encoding in headless WebKit",
  );
  await page.goto(PATH);
  await expect(pack(page)).toHaveAttribute("data-pack-state", "EMPTY");
});

test("page: three steps with their own requirements, pack status, source", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CCC Complete Pack");
  for (const [index, preset] of PRESETS.entries()) {
    const section = asset(page, preset);
    await expect(section.getByRole("heading", { level: 2 })).toContainText(`${index + 1}.`);
    const required = section.getByRole("region", { name: "Required" });
    await expect(required.getByText(`${preset.width} × ${preset.height} px`)).toBeVisible();
    await expect(
      required.getByText(`${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`),
    ).toBeVisible();
    await expect(required.getByText(`${preset.dpi.min}–${preset.dpi.max}`)).toBeVisible();
    await expect(statusRow(page, preset)).toHaveAttribute("data-state", "EMPTY");
    await expect(statusRow(page, preset)).toContainText("Not started");
  }
  await expect(page.getByRole("button", { name: "Download All (ZIP)" })).toHaveCount(0);
  await expect(page.getByTestId("requirements-source")).toHaveCount(1); // shared source, once
  await expect(page.getByTestId("requirements-source")).toContainText("Version 1.11 (2023)");
  for (const href of [
    "/ccc-photo-resizer",
    "/ccc-signature-resizer",
    "/ccc-thumb-impression-resizer",
  ]) {
    await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
  }
});

test("valid pack: all READY → Download All ZIP holds the exact processed files", async ({
  page,
}) => {
  await recordAnalytics(page);
  await page.reload();
  const uploads = recordNonGetRequests(page);

  await processAsset(page, CCC_PHOTO, "noise");
  // Not ready until all three are processed.
  await expect(pack(page)).toHaveAttribute("data-pack-state", "IN_PROGRESS");
  await expect(page.getByRole("button", { name: "Download All (ZIP)" })).toHaveCount(0);
  await processAsset(page, CCC_SIGNATURE, "noise");
  await processAsset(page, CCC_LEFT_THUMB, "noise");

  await expect(pack(page)).toHaveAttribute("data-pack-state", "READY");
  for (const preset of PRESETS) {
    await expect(statusRow(page, preset)).toHaveAttribute("data-state", "READY");
    await expect(statusRow(page, preset)).toContainText("Ready");
  }
  await expect(page.getByTestId("pack-warning")).toHaveCount(0);

  // Individual downloads still work.
  const individual: { name: string; bytes: Uint8Array }[] = [];
  for (const preset of PRESETS) {
    const file = await individualDownload(page, asset(page, preset));
    expect(file.name).toBe(buildDownloadFilename(preset));
    individual.push(file);
  }

  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download All (ZIP)" }).click();
  const zip = await zipPromise;
  expect(zip.suggestedFilename()).toBe(buildPackFilename("ccc"));
  const entries = readZip(await downloadBytes(zip));
  expect(entries.map((entry) => entry.name)).toEqual(PRESETS.map(buildDownloadFilename));
  entries.forEach((entry, i) => {
    expect(entry.data).toEqual(individual[i].bytes); // same bytes, not re-encoded
    expect(readJpegFacts(entry.data)).toMatchObject({
      width: PRESETS[i].width,
      height: PRESETS[i].height,
      format: "jpeg",
      metadata: [],
    });
  });

  expect(uploads).toEqual([]); // nothing left the browser
  const events = await analyticsEvents(page);
  for (const name of ["tool_viewed", "pack_completed", "download_started", "download_completed"]) {
    expect(events).toContain(name);
  }
  // One view for the pack, not one per embedded tool; one completion per asset.
  expect(events.filter((name) => name === "tool_viewed")).toHaveLength(1);
  expect(events.filter((name) => name === "pack_asset_completed")).toHaveLength(3);
  const payloads = await analyticsPayloads(page);
  // The ZIP download (per-file downloads in the steps are reported with their asset_type).
  const zipDownloads = payloads.filter(
    (e) => e.name === "download_completed" && e.props.output_format === "zip",
  );
  expect(zipDownloads).toHaveLength(1);
  expect(zipDownloads[0].props).toMatchObject({
    tool_id: "ccc-pack",
    tool_type: "pack",
    asset_type: "pack",
    output_format: "zip",
  });
});

test("warning pack: a below-minimum file is flagged but the pack stays downloadable", async ({
  page,
}) => {
  await processAsset(page, CCC_PHOTO, "noise");
  await processAsset(page, CCC_SIGNATURE, "flat");
  await processAsset(page, CCC_LEFT_THUMB, "noise");

  await expect(pack(page)).toHaveAttribute("data-pack-state", "READY_WITH_WARNING");
  await expect(statusRow(page, CCC_SIGNATURE)).toHaveAttribute("data-state", "READY_WITH_WARNING");
  await expect(statusRow(page, CCC_SIGNATURE)).toContainText("Signature — Below minimum file size");
  await expect(statusRow(page, CCC_PHOTO)).toContainText("Photo — Ready");
  await expect(page.getByTestId("pack-warning")).toContainText(
    "One or more files are below the stated minimum file size. We kept the highest-quality versions.",
  );

  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download All (ZIP)" }).click();
  const entries = readZip(await downloadBytes(await zipPromise));
  expect(entries).toHaveLength(3);
  expect(entries[1].data.length).toBeLessThan(CCC_SIGNATURE.fileSizeKB.min * 1024);
});

test("incomplete pack: an unusable file blocks Download All and is named", async ({ page }) => {
  await processAsset(page, CCC_PHOTO, "noise");
  await processAsset(page, CCC_SIGNATURE, "noise");
  await upload(asset(page, CCC_LEFT_THUMB), Buffer.from("not an image"), "thumb.jpg");
  await expect(asset(page, CCC_LEFT_THUMB).getByRole("alert")).toContainText(
    "This image format isn't supported",
  );

  await expect(pack(page)).toHaveAttribute("data-pack-state", "INCOMPLETE");
  await expect(statusRow(page, CCC_LEFT_THUMB)).toHaveAttribute("data-state", "ERROR");
  await expect(statusRow(page, CCC_LEFT_THUMB)).toContainText("Left thumb impression — Error");
  await expect(page.getByTestId("pack-status")).toContainText(
    "Left thumb impression needs attention",
  );
  await expect(page.getByRole("button", { name: "Download All (ZIP)" })).toHaveCount(0);
  // Finished files keep their own downloads.
  await expect(asset(page, CCC_PHOTO).getByRole("link", { name: "Download JPG" })).toBeVisible();
});

test("start again clears every file, result, warning and the pack state", async ({ page }) => {
  await recordAnalytics(page);
  await page.reload();
  await processAsset(page, CCC_PHOTO, "noise");
  await processAsset(page, CCC_SIGNATURE, "flat");
  await upload(asset(page, CCC_LEFT_THUMB), Buffer.from("not an image"), "thumb.jpg");
  await expect(pack(page)).toHaveAttribute("data-pack-state", "INCOMPLETE");

  await page
    .getByTestId("pack-status")
    .getByRole("button", { name: "Start again with all files" })
    .click();

  await expect(pack(page)).toHaveAttribute("data-pack-state", "EMPTY");
  for (const preset of PRESETS) {
    await expect(assetTool(page, preset)).toHaveAttribute("data-state", "SELECT");
    await expect(statusRow(page, preset)).toHaveAttribute("data-state", "EMPTY");
    await expect(asset(page, preset).locator("img")).toHaveCount(0);
    await expect(asset(page, preset).getByRole("alert")).toHaveCount(0);
  }
  await expect(page.getByTestId("pack-warning")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download All (ZIP)" })).toHaveCount(0);
  const completions = async () =>
    (await analyticsEvents(page)).filter((name) => name === "pack_asset_completed").length;
  expect(await completions()).toBe(2);

  // No stale result survives: the pack becomes ready again only after reprocessing,
  // and the reprocessed asset is reported as completed again.
  await processAsset(page, CCC_PHOTO, "noise");
  await expect(pack(page)).toHaveAttribute("data-pack-state", "IN_PROGRESS");
  await expect.poll(completions).toBe(3);
});

test("mobile: steps stack without horizontal overflow; touch targets ≥ 44 px", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone viewport only");
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
  const first = asset(page, CCC_PHOTO).getByRole("button", { name: "Choose photo" });
  const box = (await first.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await processAsset(page, CCC_PHOTO, "noise");
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
});
