import { expect, test, type Page } from "@playwright/test";
import { insertExif } from "../src/lib/image/testing/exif-builder";
import { EVENT_PROPS, CONTEXT_PROPS } from "../src/lib/analytics/taxonomy";
import { CCC_PHOTO } from "../src/lib/presets/ccc";
import {
  analyticsEvents,
  analyticsPayloads,
  downloadBytes,
  makeImage,
  recordAnalytics,
  recordNonGetRequests,
  RESULT_EVENTS,
  upload,
  type RecordedEvent,
} from "./helpers";
import { TOOLS } from "../src/lib/tools/registry";

// The exam chip links to the exam's hub: its pack if it has one, otherwise its first live tool.
const IBPS_HUB =
  TOOLS.find((t) => t.exam === "ibps" && t.kind === "pack" && t.status === "live") ??
  TOOLS.find((t) => t.exam === "ibps" && t.status === "live")!;

/**
 * Analytics foundation (P9): funnel events, privacy of payloads, and that the
 * tools keep working when analytics fails. No provider is installed, so events
 * are observed through the local `epf:analytics` DOM event.
 */

const PROCESSING_TIMEOUT = { timeout: 30_000 };
const tool = (page: Page) => page.getByTestId("image-tool");

// A camera-style JPEG and a filename full of personal data.
const SENSITIVE_NAME = "Ravi_Kumar_9876543210_ravi@example.com_passport.jpg";
// Includes the fixture's EXIF values: GPS 28°36'50" N, 77°12'30" E (as degrees or decimals).
const FORBIDDEN =
  /Ravi|Kumar|9876543210|example\.com|passport|blob:|data:|base64|PhoneCo|Camera X|2026:09:24|GPS|https?:|28\.6\d|77\.2\d|\b28\D36\b|\b77\D12\b/i;
/** The only numeric property; every other value is an id, bucket, state or boolean. */
const NUMERIC_PROPS = new Set(["asset_count"]);

async function cameraJpeg(page: Page) {
  return Buffer.from(
    insertExif(new Uint8Array(await makeImage(page, "noise", 600, 800)), {
      orientation: 1,
      gps: true,
      make: "PhoneCo",
      model: "Camera X",
      dateTime: "2026:09:24 10:00:00",
    }),
  );
}

function expectSafe(events: RecordedEvent[]) {
  for (const event of events) {
    const allowed = new Set<string>([
      ...EVENT_PROPS[event.name as keyof typeof EVENT_PROPS],
      ...CONTEXT_PROPS,
    ]);
    for (const [key, value] of Object.entries(event.props)) {
      expect(allowed.has(key), `${event.name}.${key} is allowlisted`).toBe(true);
      expect(String(value).length, `${event.name}.${key}`).toBeLessThanOrEqual(64);
      if (typeof value === "number")
        expect(NUMERIC_PROPS.has(key), `${event.name}.${key}`).toBe(true);
    }
    expect(JSON.stringify(event), event.name).not.toMatch(FORBIDDEN);
  }
}

/**
 * Clicks the requirement source link without leaving the page: the click still reaches the
 * analytics listener (document, capture phase); a later window listener cancels the
 * navigation, so the test never opens the external source.
 */
async function clickSourceLink(page: Page) {
  await page.evaluate(() =>
    window.addEventListener("click", (event) => event.preventDefault(), { once: true }),
  );
  await page
    .getByTestId("requirements-source")
    .getByRole("link", { name: /^View source/ })
    .click();
}

test.beforeEach(async ({ page, browserName }) => {
  test.slow(browserName === "webkit", "Slow image encoding in headless WebKit");
  await recordAnalytics(page);
});

test("preset funnel: one event per step, one result per job, and no personal or image data", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  // Context-level, so requests from the page's image worker are included too.
  const requests: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  await page.goto("/ccc-photo-resizer");
  const uploads = recordNonGetRequests(page);
  await expect(tool(page)).toHaveAttribute("data-state", "SELECT");

  await upload(page, await cameraJpeg(page), SENSITIVE_NAME);
  await expect(tool(page)).toHaveAttribute("data-state", "CROP");
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY", PROCESSING_TIMEOUT);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JPG" }).click();
  await downloadBytes(await downloadPromise);
  await expect.poll(() => analyticsEvents(page)).toContain("download_completed");

  expect(await analyticsEvents(page)).toEqual([
    "page_view",
    "tool_viewed",
    "image_selected",
    "processing_started",
    "processing_completed",
    "result_ready",
    "download_started",
    "download_completed",
  ]);
  const events = await analyticsPayloads(page);
  const byName = (name: string) => events.find((event) => event.name === name)!.props;
  const job = {
    tool_id: "ccc-photo",
    tool_type: "preset",
    exam_id: "ccc",
    asset_type: CCC_PHOTO.documentType,
  };
  expect(byName("tool_viewed")).toMatchObject({
    tool_id: "ccc-photo",
    route: "/ccc-photo-resizer",
  });
  expect(byName("image_selected")).toMatchObject({
    ...job,
    accepted: true,
    input_format: "jpeg",
    input_megapixel_bucket: "0.1_1mp",
  });
  expect(byName("processing_completed")).toMatchObject({ ...job, result_state: "READY" });
  expect(byName("result_ready")).toMatchObject({ ...job, result_state: "READY" });
  expect(byName("download_completed")).toMatchObject({ ...job, result_state: "READY" });
  for (const event of events) {
    expect(event.props).toMatchObject({ page_category: "tool" });
    expect(event.props.device_class).toMatch(/^(mobile|tablet|desktop)$/);
  }

  expectSafe(events);
  expect(uploads).toEqual([]);
  // Nothing went to another origin (no analytics endpoint, no upload), from the page or its worker.
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin) && !url.startsWith("blob:"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("below minimum → result_ready_with_warning with a stable reason code", async ({ page }) => {
  await page.goto("/ccc-photo-resizer");
  await upload(page, await makeImage(page, "flat", 600, 800));
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY_WITH_WARNING", PROCESSING_TIMEOUT);
  const events = await analyticsPayloads(page);
  const results = events.filter((event) => RESULT_EVENTS.includes(event.name));
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    name: "result_ready_with_warning",
    props: { result_state: "READY_WITH_WARNING", reason_code: "FILE_TOO_SMALL" },
  });
});

test("compressor limit not reached → validation_failed with its reason code", async ({ page }) => {
  await page.goto("/image-compressor");
  await upload(page, await makeImage(page, "noise", 1500, 1500));
  await expect(tool(page)).toHaveAttribute("data-state", "CONFIGURE");
  await page.getByLabel("100 KB").check();
  await page.getByRole("button", { name: "Compress Image" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "LIMIT_NOT_REACHED", PROCESSING_TIMEOUT);
  const events = await analyticsPayloads(page);
  const results = events.filter((event) => RESULT_EVENTS.includes(event.name));
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    name: "validation_failed",
    props: {
      tool_id: "image-compressor",
      tool_type: "generic-compress",
      result_state: "INVALID",
      reason_code: "COMPRESSION_LIMIT_NOT_REACHED",
    },
  });
  expect(events.map((event) => event.name)).not.toContain("download_started");
});

test("rejected file: image_selected with an engine error code, no job events", async ({ page }) => {
  await page.goto("/ccc-photo-resizer");
  await upload(page, Buffer.from("not an image"), SENSITIVE_NAME);
  await expect(tool(page).getByRole("alert")).toBeVisible();
  const events = await analyticsPayloads(page);
  expect(events.map((event) => event.name)).toEqual(["page_view", "tool_viewed", "image_selected"]);
  expect(events[2].props).toMatchObject({ accepted: false, error_code: "unsupported-format" });
  expectSafe(events);
});

test("tools keep working end to end when analytics throws", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event: Event) => {
      if (event.type === "epf:analytics") throw new Error("analytics unavailable");
      return original(event);
    };
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/ccc-photo-resizer");
  await upload(page, await cameraJpeg(page), SENSITIVE_NAME);
  await page.getByRole("button", { name: "Process photo" }).click();
  await expect(tool(page)).toHaveAttribute("data-state", "READY", PROCESSING_TIMEOUT);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JPG" }).click();
  expect((await downloadBytes(await downloadPromise)).length).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
  expect(await analyticsEvents(page)).toEqual([]); // nothing was delivered, and nothing broke
});

test("guide → tool click and requirement source link are reported by id, not URL", async ({
  page,
}) => {
  await page.goto("/guides/ccc-photo-size");
  await clickSourceLink(page);
  await page
    .getByRole("navigation", { name: "Tools for this guide" })
    .getByRole("link")
    .first()
    .click();
  await expect(page).toHaveURL(/\/ccc-photo-resizer$/);
  await expect.poll(() => analyticsEvents(page)).toContain("tool_viewed");

  const events = await analyticsPayloads(page);
  expect(events.find((e) => e.name === "requirement_source_opened")?.props).toMatchObject({
    source_id: CCC_PHOTO.source.id,
    page_category: "guide",
    guide_id: "ccc-photo-size",
  });
  expect(events.find((e) => e.name === "guide_tool_clicked")?.props).toMatchObject({
    guide_id: "ccc-photo-size",
    tool_id: "ccc-photo",
    source_page_category: "guide",
  });
  // Client-side navigation still records the new page.
  expect(events.filter((e) => e.name === "page_view").map((e) => e.props.route)).toEqual([
    "/guides/ccc-photo-size",
    "/ccc-photo-resizer",
  ]);
  expectSafe(events);
});

test("source link on a tool page carries the tool id", async ({ page }) => {
  await page.goto("/ccc-photo-resizer");
  await clickSourceLink(page);
  const events = await analyticsPayloads(page);
  expect(events.find((e) => e.name === "requirement_source_opened")?.props).toMatchObject({
    source_id: CCC_PHOTO.source.id,
    page_category: "tool",
    tool_id: "ccc-photo",
  });
});

test("exam search reports the chosen exam, never the typed text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search your exam" }).fill("institute of banking");
  await page.getByRole("link", { name: "IBPS", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${IBPS_HUB.path}$`));
  const events = await analyticsPayloads(page);
  expect(events.find((e) => e.name === "exam_selected")?.props).toMatchObject({
    exam_id: "ibps",
    destination_tool_id: IBPS_HUB.id,
    source_page_category: "home",
  });
  expect(JSON.stringify(events)).not.toMatch(/institute|banking/i);
});

test("landing page view: referrer category and whitelisted UTM only", async ({ page }) => {
  await page.goto(
    "/?utm_source=Newsletter&utm_medium=email&utm_term=ravi&utm_content=x&q=Ravi+Kumar&email=ravi%40example.com",
    { referer: "https://www.google.com/search?q=ccc+photo+ravi" },
  );
  await expect.poll(() => analyticsEvents(page)).toContain("page_view");
  const [view] = await analyticsPayloads(page);
  expect(view).toEqual({
    name: "page_view",
    props: expect.objectContaining({
      route: "/",
      page_category: "home",
      referrer_category: "organic_search",
      utm_source: "newsletter",
      utm_medium: "email",
    }),
  });
  expect(Object.keys(view.props)).not.toContain("utm_term");
  expectSafe([view]);
});
