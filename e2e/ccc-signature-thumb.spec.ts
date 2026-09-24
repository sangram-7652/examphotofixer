import { expect, test, type Page } from "@playwright/test";
import { readJpegFacts } from "../src/lib/image/inspect";
import { CCC_LEFT_THUMB, CCC_SIGNATURE } from "../src/lib/presets/ccc";
import type { ImagePreset } from "../src/lib/presets/types";
import { buildDownloadFilename } from "../src/lib/tools/preset-labels";
import {
  downloadBytes,
  hasNoHorizontalOverflow,
  makeImage,
  recordNonGetRequests,
  upload,
} from "./helpers";

/**
 * The signature and left thumb impression tools reuse the same ImageTool as the
 * photo tool; this spec runs the same core flow against both presets.
 */

const TOOLS: { path: string; h1: string; noun: string; preset: ImagePreset }[] = [
  {
    path: "/ccc-signature-resizer",
    h1: "CCC Signature Resizer",
    noun: "signature",
    preset: CCC_SIGNATURE,
  },
  {
    path: "/ccc-thumb-impression-resizer",
    h1: "CCC Left Thumb Impression Resizer",
    noun: "thumb impression",
    preset: CCC_LEFT_THUMB,
  },
];

for (const { path, h1, noun, preset } of TOOLS) {
  const SIZE = `${preset.width} × ${preset.height} px`;
  const KB = `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`;
  const tool = (page: Page) => page.getByTestId("image-tool");

  test.describe(path, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
      await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
    });

    test("page: H1, requirements from the preset, guidance, source citation, pack link", async ({
      page,
    }) => {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      const required = tool(page).getByRole("region", { name: "Required" });
      await expect(required.getByText(SIZE)).toBeVisible();
      await expect(required.getByText(KB)).toBeVisible();
      await expect(required.getByText("JPG/JPEG")).toBeVisible();
      await expect(required.getByText(`${preset.dpi.min}–${preset.dpi.max}`)).toBeVisible();
      for (const line of preset.guidance ?? []) {
        await expect(page.getByText(line).first()).toBeVisible();
      }
      const source = page.getByTestId("requirements-source");
      await expect(source).toContainText(
        "NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)",
      );
      await expect(source.getByRole("link", { name: /^View source/ })).toHaveAttribute(
        "href",
        preset.source.url!,
      );
      await expect(page.getByRole("link", { name: "Use the CCC Complete Pack" })).toHaveAttribute(
        "href",
        "/ccc-complete-pack",
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${path}$`),
      );
      // No page-level noindex: robots meta equals the site-wide default (home page).
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      await page.goto("/");
      expect(await page.locator('meta[name="robots"]').getAttribute("content")).toBe(robots);
    });

    test("upload → crop → process → READY → download → start again", async ({ page }) => {
      const uploads = recordNonGetRequests(page);
      await upload(page, await makeImage(page, "noise", 800, 600), "scan.jpg");
      await expect(tool(page)).toHaveAttribute("data-state", "CROP");
      await expect(page.getByTestId("selected-file")).toContainText("scan.jpg");

      const position = page.getByTestId("crop-position");
      const before = await position.textContent();
      await page.getByRole("button", { name: "Zoom in" }).click();
      const frame = page.getByTestId("crop-frame");
      const box = (await frame.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 4 });
      await page.mouse.up();
      await expect(position).not.toHaveText(before!);
      expect(box.width / box.height).toBeCloseTo(preset.width / preset.height, 1);

      await page.getByRole("button", { name: `Process ${noun}` }).click();
      await expect(tool(page)).toHaveAttribute("data-state", "READY");
      const checklist = page.getByTestId("checklist");
      for (const id of ["dimensions", "file-size", "format", "dpi", "metadata"]) {
        await expect(checklist.locator(`[data-check="${id}"]`)).toHaveAttribute(
          "data-status",
          "pass",
        );
      }
      await expect(checklist.locator('[data-check="dimensions"]')).toContainText(SIZE);

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download JPG" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(buildDownloadFilename(preset));
      const facts = readJpegFacts(await downloadBytes(download))!;
      expect(facts).toMatchObject({
        width: preset.width,
        height: preset.height,
        format: "jpeg",
        metadata: [],
      });
      expect(facts.dpi!.x).toBeGreaterThanOrEqual(preset.dpi.min);
      expect(facts.dpi!.x).toBeLessThanOrEqual(preset.dpi.max!);
      expect(facts.byteLength).toBeGreaterThanOrEqual(preset.fileSizeKB.min * 1024);
      expect(facts.byteLength).toBeLessThanOrEqual(preset.fileSizeKB.max * 1000);

      await page.getByRole("button", { name: "Start again" }).click();
      await expect(tool(page)).toHaveAttribute("data-state", "SELECT");
      await expect(tool(page).locator("img")).toHaveCount(0);
      expect(uploads).toEqual([]);
    });

    test("plain image below minimum → warning, Download Anyway", async ({ page }) => {
      await upload(page, await makeImage(page, "flat", 800, 600), "blank.jpg");
      await expect(tool(page)).toHaveAttribute("data-state", "CROP");
      await page.getByRole("button", { name: `Process ${noun}` }).click();
      await expect(tool(page)).toHaveAttribute("data-state", "READY_WITH_WARNING");
      await expect(
        page.getByTestId("checklist").locator('[data-check="file-size"]'),
      ).toHaveAttribute("data-status", "warning");
      await expect(page.getByTestId("size-warning")).toContainText(
        "We kept the highest-quality version instead of adding artificial data.",
      );
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download Anyway" }).click();
      const bytes = await downloadBytes(await downloadPromise);
      expect(bytes.length).toBeLessThan(preset.fileSizeKB.min * 1024);
      expect(readJpegFacts(bytes)?.metadata).toEqual([]);
    });

    test("mobile: tool in first screen, neutral camera wording, no overflow", async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "phone viewport only");
      const choose = page.getByRole("button", { name: `Choose ${noun}` });
      const box = (await choose.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await expect(page.getByRole("button", { name: "Capture image" })).toBeVisible();
      await expect(
        page.getByText("follow the application's official image instructions", { exact: false }),
      ).toBeVisible();
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });
  });
}
