import { expect, test, type Page } from "@playwright/test";
import { downloadBytes, makeImage, upload } from "./helpers";

/**
 * Keyboard-only use of a tool (P10 launch audit): controls are reachable with Tab and show a
 * visible focus indicator, processing and download work with Enter, focus moves to the result
 * and the live region announces it. File choice itself uses the platform file dialog, which
 * tests can't drive by keyboard; the file is handed to the input as in the other specs.
 */

const PROCESSING_TIMEOUT = { timeout: 30_000 };

/** Tabs forward until `target` has focus (fails after `limit` presses). */
async function tabTo(page: Page, name: string, limit = 60) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (el?.getAttribute("aria-label") ?? el?.textContent ?? "").trim();
    });
    if (label.startsWith(name)) return;
  }
  throw new Error(`"${name}" not reachable with Tab`);
}

async function focusIsVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== "none";
    return el.matches(":focus-visible") && (outline || ring);
  });
}

test("keyboard only: process, hear the result, download", async ({ page, browserName }) => {
  test.slow(browserName === "webkit", "Slow image encoding in headless WebKit");
  await page.goto("/ccc-photo-resizer");
  const tool = page.getByTestId("image-tool");
  await upload(page, await makeImage(page, "noise", 600, 800));
  await expect(tool).toHaveAttribute("data-state", "CROP");

  await tabTo(page, "Process photo");
  expect(await focusIsVisible(page)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(tool).toHaveAttribute("data-state", "READY", PROCESSING_TIMEOUT);

  // Focus moves to the result heading and the polite live region announces the state.
  await expect(tool.getByRole("heading", { level: 2 }).first()).toBeFocused();
  await expect(tool.getByRole("status")).not.toBeEmpty();

  await tabTo(page, "Download JPG");
  expect(await focusIsVisible(page)).toBe(true);
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await downloadBytes(await download)).length).toBeGreaterThan(0);
});

test("keyboard only: home → exam chip → tool, with visible focus", async ({ page }) => {
  await page.goto("/");
  await tabTo(page, "IBPS");
  expect(await focusIsVisible(page)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ibps-photo-resizer$/);
});
