import { expect, test, type Page } from "@playwright/test";
import { readJpegFacts } from "../src/lib/image/inspect";
import { insertExif } from "../src/lib/image/testing/exif-builder";
import {
  IBPS_DECLARATION,
  IBPS_LEFT_THUMB,
  IBPS_PHOTO,
  IBPS_SIGNATURE,
} from "../src/lib/presets/ibps";
import type { ImagePreset } from "../src/lib/presets/types";
import { buildDownloadFilename, buildPackFilename } from "../src/lib/tools/preset-labels";
import { readZip } from "../src/lib/zip/testing/read-zip";
import {
  downloadBytes,
  hasNoHorizontalOverflow,
  makeImage,
  recordAnalytics,
  analyticsPayloads,
  recordNonGetRequests,
  upload,
  type Pattern,
} from "./helpers";

/**
 * IBPS signature, left thumb impression and hand-written declaration tools (P12), and the IBPS
 * Complete Pack. Every expected value comes from the presets; downloads are re-validated from
 * their bytes.
 */

const PROCESSING_TIMEOUT = { timeout: 30_000 };
const TOOLS: { path: string; h1: string; noun: string; preset: ImagePreset }[] = [
  {
    path: "/ibps-signature-resizer",
    h1: "IBPS Signature Resizer",
    noun: "signature",
    preset: IBPS_SIGNATURE,
  },
  {
    path: "/ibps-thumb-impression-resizer",
    h1: "IBPS Left Thumb Impression Resizer",
    noun: "thumb impression",
    preset: IBPS_LEFT_THUMB,
  },
  {
    path: "/ibps-handwritten-declaration-resizer",
    h1: "IBPS Hand-written Declaration Resizer",
    noun: "declaration",
    preset: IBPS_DECLARATION,
  },
];
const tool = (page: Page) => page.getByTestId("image-tool");

/**
 * Source images at the target size, so the noise pattern keeps full detail. A larger noise
 * image is smoothed by downscaling, and WebKit's JPEG encoder (smaller files at maximum
 * quality than Chromium/Firefox) then lands below the signature's minimum — correctly a
 * warning, but not the READY path this spec checks. See docs/EXAM_REQUIREMENT_VERIFICATION.md.
 */
function sourceSize(preset: ImagePreset): [number, number] {
  return [preset.width, preset.height];
}

test.beforeEach(({ browserName }) => {
  test.slow(browserName === "webkit", "Slow JPEG encoding in headless WebKit");
});

for (const { path, h1, noun, preset } of TOOLS) {
  test.describe(path, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
      await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
    });

    test("page: requirements and guidance from the preset, source with pages, pack link, no claims", async ({
      page,
    }) => {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      const required = tool(page).getByRole("region", { name: "Required" });
      await expect(required.getByText(`${preset.width} × ${preset.height} px`)).toBeVisible();
      await expect(
        required.getByText(`${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`),
      ).toBeVisible();
      await expect(required.getByText("JPG/JPEG")).toBeVisible();
      await expect(required.getByText(`${preset.dpi.min} or more`)).toBeVisible();
      for (const line of preset.guidance ?? []) {
        await expect(page.getByText(line).first()).toBeVisible();
      }
      const source = page.getByTestId("requirements-source");
      await expect(source).toContainText("IBPS CRP RRBs-XV Detailed Notification");
      // "XV" names the recruitment cycle, not a document revision — never shown as "Version XV".
      await expect(source).not.toContainText("Version XV");
      await expect(source).toContainText("pages 57 and 58");
      await expect(source).toContainText(
        "Verified against the IBPS CRP RRBs-XV notification dated 1 September 2026.",
      );
      await expect(source).toContainText("Other IBPS recruitments");
      await expect(source.getByRole("link", { name: /^View source/ })).toHaveAttribute(
        "href",
        preset.source.url!,
      );
      const packLink = page.getByRole("link", { name: "Use the IBPS Complete Pack" });
      await expect(packLink).toHaveAttribute("href", "/ibps-complete-pack");
      await expect(packLink.locator("xpath=..")).toContainText(
        "photo, signature, left thumb impression and hand-written declaration",
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${path}$`),
      );
      const text = (await page.locator("main").innerText()).toLowerCase();
      for (const claim of ["official ibps", "approved by ibps", "guaranteed", "100% accept"]) {
        expect(text).not.toContain(claim);
      }
    });

    test("upload → process → READY → download: exact size, bytes in range, JPEG, DPI, no EXIF; nothing uploaded", async ({
      page,
    }) => {
      const uploads = recordNonGetRequests(page);
      const [w, h] = sourceSize(preset);
      const scan = Buffer.from(
        insertExif(new Uint8Array(await makeImage(page, "noise", w, h)), {
          orientation: 1,
          gps: true,
          make: "PhoneCo",
          model: "Camera X",
          dateTime: "2026:09:25 10:00:00",
        }),
      );
      await upload(page, scan, "Ravi Kumar scan.jpg");
      await expect(tool(page)).toHaveAttribute("data-state", "CROP");
      await page.getByRole("button", { name: `Process ${noun}` }).click();
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
      expect(download.suggestedFilename()).toBe(buildDownloadFilename(preset));
      const bytes = await downloadBytes(download);
      const facts = readJpegFacts(bytes)!;
      expect(facts).toMatchObject({
        width: preset.width,
        height: preset.height,
        format: "jpeg",
        metadata: [],
      });
      expect(facts.dpi!.x).toBeGreaterThanOrEqual(preset.dpi.min);
      expect(bytes.length).toBeGreaterThanOrEqual(preset.fileSizeKB.min * 1024);
      expect(bytes.length).toBeLessThanOrEqual(preset.fileSizeKB.max * 1000);
      const raw = Buffer.from(bytes).toString("latin1");
      for (const leaked of ["Exif", "PhoneCo", "Camera X", "2026:09:25"]) {
        expect(raw).not.toContain(leaked);
      }
      expect(uploads).toEqual([]);
    });

    test("plain image below the minimum → warning, Download Anyway, never padded", async ({
      page,
    }) => {
      const [w, h] = sourceSize(preset);
      await upload(page, await makeImage(page, "flat", w, h), "blank.jpg");
      await page.getByRole("button", { name: `Process ${noun}` }).click();
      await expect(tool(page)).toHaveAttribute(
        "data-state",
        "READY_WITH_WARNING",
        PROCESSING_TIMEOUT,
      );
      await expect(
        page.getByTestId("checklist").locator('[data-check="file-size"]'),
      ).toHaveAttribute("data-status", "warning");
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download Anyway" }).click();
      const bytes = await downloadBytes(await downloadPromise);
      expect(bytes.length).toBeLessThan(preset.fileSizeKB.min * 1024);
      expect(readJpegFacts(bytes)).toMatchObject({ width: preset.width, height: preset.height });
    });

    test("mobile: tool in first screen, no overflow", async ({ page, isMobile }) => {
      test.skip(!isMobile, "phone viewport only");
      const choose = page.getByRole("button", { name: `Choose ${noun}` });
      const box = (await choose.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });
  });
}

test.describe("/ibps-complete-pack", () => {
  const PRESETS = [IBPS_PHOTO, IBPS_SIGNATURE, IBPS_LEFT_THUMB, IBPS_DECLARATION];
  const NOUNS: Record<string, string> = {
    "ibps-photo": "photo",
    "ibps-signature": "signature",
    "ibps-left-thumb": "thumb impression",
    "ibps-declaration": "declaration",
  };
  const asset = (page: Page, preset: ImagePreset) => page.getByTestId(`pack-asset-${preset.id}`);
  const pack = (page: Page) => page.getByTestId("pack-tool");

  async function processAsset(page: Page, preset: ImagePreset, pattern: Pattern) {
    const section = asset(page, preset);
    const [w, h] = sourceSize(preset);
    await upload(section, await makeImage(page, pattern, w, h), `${preset.id}.jpg`);
    await expect(section.getByTestId("image-tool")).toHaveAttribute("data-state", "CROP");
    await section.getByRole("button", { name: `Process ${NOUNS[preset.id]}` }).click();
    await expect(section.getByTestId("image-tool")).toHaveAttribute(
      "data-state",
      /^(READY|READY_WITH_WARNING)$/,
      PROCESSING_TIMEOUT,
    );
  }

  test.beforeEach(async ({ page }) => {
    test.slow(); // four images per test
    await recordAnalytics(page);
    await page.goto("/ibps-complete-pack");
    await expect(pack(page)).toHaveAttribute("data-pack-state", "EMPTY");
  });

  test("four steps with their own requirements; one shared source citing pages 56–58", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("IBPS Complete Pack");
    await expect(pack(page)).toContainText("Add all four files to build your pack.");
    for (const [index, preset] of PRESETS.entries()) {
      const section = asset(page, preset);
      await expect(section.getByRole("heading", { level: 2 })).toContainText(`${index + 1}.`);
      const required = section.getByRole("region", { name: "Required" });
      await expect(required.getByText(`${preset.width} × ${preset.height} px`)).toBeVisible();
      await expect(
        required.getByText(`${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`),
      ).toBeVisible();
    }
    const source = page.getByTestId("requirements-source");
    await expect(source).toHaveCount(1);
    await expect(source).toContainText("pages 56, 57 and 58");
  });

  test("all four processed → ZIP holds exactly the four validated files; nothing uploaded", async ({
    page,
  }) => {
    const uploads = recordNonGetRequests(page);
    for (const preset of PRESETS) await processAsset(page, preset, "noise");
    await expect(pack(page)).toHaveAttribute("data-pack-state", "READY");
    const zipPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download All (ZIP)" }).click();
    const zip = await zipPromise;
    expect(zip.suggestedFilename()).toBe(buildPackFilename("ibps"));
    const entries = readZip(await downloadBytes(zip));
    expect(entries.map((entry) => entry.name)).toEqual(PRESETS.map(buildDownloadFilename));
    entries.forEach((entry, i) => {
      const preset = PRESETS[i];
      expect(readJpegFacts(entry.data)).toMatchObject({
        width: preset.width,
        height: preset.height,
        format: "jpeg",
        metadata: [],
      });
      expect(entry.data.length).toBeGreaterThanOrEqual(preset.fileSizeKB.min * 1024);
      expect(entry.data.length).toBeLessThanOrEqual(preset.fileSizeKB.max * 1000);
    });
    expect(uploads).toEqual([]);
    const events = await analyticsPayloads(page);
    expect(events.filter((e) => e.name === "pack_asset_completed")).toHaveLength(4);
    expect(events.find((e) => e.name === "pack_completed")?.props).toMatchObject({
      tool_id: "ibps-pack",
      exam_id: "ibps",
      asset_count: 4,
    });
    expect(JSON.stringify(events)).not.toMatch(/\.jpg|blob:|data:|Ravi/);
  });
});
