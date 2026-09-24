import { expect, test } from "@playwright/test";
import { getGuide, listGuides } from "../src/content/guides";
import { getPreset } from "../src/lib/presets";
import { dpiText } from "../src/lib/presets/describe";
import { sourceCitation } from "../src/lib/presets/source";
import { getTool } from "../src/lib/tools/registry";
import { hasNoHorizontalOverflow } from "./helpers";

test("/guides lists every published guide by category, with working links", async ({ page }) => {
  await page.goto("/guides");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guides");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/guides$/);
  for (const category of ["CCC", "Application Help"]) {
    await expect(page.getByRole("heading", { level: 2, name: category })).toBeVisible();
  }
  for (const guide of listGuides()) {
    await expect(page.getByRole("link", { name: guide.title })).toHaveAttribute(
      "href",
      `/guides/${guide.slug}`,
    );
  }
  await page.getByRole("link", { name: listGuides()[0].title }).click();
  await expect(page).toHaveURL(new RegExp(`/guides/${listGuides()[0].slug}$`));
});

for (const guide of listGuides()) {
  test(`${guide.slug}: H1, metadata, preset values, source, tool links`, async ({ page }) => {
    await page.goto(`/guides/${guide.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(guide.title);
    await expect(page).toHaveTitle(
      new RegExp(guide.metaTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      guide.description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/guides/${guide.slug}$`),
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      guide.metaTitle,
    );

    // Requirement values rendered from the preset, with the shared source section.
    for (const id of guide.presetIds) {
      const preset = getPreset(id);
      const table = page.getByRole("region", { name: `${preset.label} requirements` });
      await expect(table.getByText(`${preset.width} × ${preset.height} pixels`)).toBeVisible();
      await expect(
        table.getByText(`${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`),
      ).toBeVisible();
      await expect(table.getByText(dpiText(preset.dpi))).toBeVisible();
    }
    // Citation and page come from the guide's own preset source.
    const cited = getPreset(guide.presetIds[0]).source;
    const source = page.getByTestId("requirements-source");
    await expect(source).toContainText(sourceCitation(cited));
    await expect(source).toContainText(`page ${cited.page}`);
    await expect(source.getByRole("link", { name: /^View source/ })).toHaveAttribute(
      "href",
      getPreset(guide.presetIds[0]).source.url!,
    );

    // Tool links use descriptive text and point at live tools.
    const nav = page.getByRole("navigation", { name: "Tools for this guide" });
    for (const link of guide.toolLinks) {
      await expect(nav.getByRole("link", { name: link.text })).toHaveAttribute(
        "href",
        getTool(link.toolId).path,
      );
    }
  });
}

test("a guide's primary tool link opens the tool", async ({ page }) => {
  const guide = getGuide("ccc-signature-size")!;
  await page.goto(`/guides/${guide.slug}`);
  await page.getByRole("link", { name: guide.toolLinks[0].text }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CCC Signature Resizer");
  // …and the tool links back to the guide.
  await expect(page.getByRole("link", { name: guide.title })).toBeVisible();
});

test("guides on a phone: no horizontal overflow, tappable tool links", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone viewport only");
  for (const guide of listGuides()) {
    await page.goto(`/guides/${guide.slug}`);
    expect(await hasNoHorizontalOverflow(page), guide.slug).toBe(true);
    const first = page
      .getByRole("navigation", { name: "Tools for this guide" })
      .getByRole("link")
      .first();
    expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
