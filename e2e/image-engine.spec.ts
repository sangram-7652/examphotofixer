import { expect, test, type Page } from "@playwright/test";
import type { Scenario, ScenarioOutcome } from "../src/app/dev/image-engine/scenarios";
import { CCC_PHOTO, CCC_SIGNATURE } from "../src/lib/presets/ccc";

/**
 * Browser integration tests for the image engine: real decoding, canvas,
 * JPEG encoding and the real Web Worker from the production build.
 * Fixtures are generated deterministically in the page (no network, no files).
 */

/** Output requirements taken from the presets (source metadata stays out of the request). */
function requirementsOf(preset: typeof CCC_PHOTO) {
  const { id, width, height, fileSizeKB, dpi, formats } = preset;
  return { id, width, height, fileSizeKB, dpi, formats };
}

const PHOTO = requirementsOf(CCC_PHOTO);
const SIGNATURE = requirementsOf(CCC_SIGNATURE);

/** Square target so every orientation maps onto the same output geometry. */
const SQUARE = { ...PHOTO, id: "square-test", width: 100, height: 100 };

const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const YELLOW = [255, 255, 0];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

function expectColor(rgba: number[], expected: number[], tolerance = 40) {
  const distance = Math.max(...expected.map((value, i) => Math.abs(value - rgba[i])));
  expect(distance, `got rgb(${rgba.slice(0, 3)}) expected rgb(${expected})`).toBeLessThanOrEqual(
    tolerance,
  );
}

async function openHarness(page: Page) {
  await page.goto("/dev/image-engine");
  await page.waitForFunction(() => window.__engineHarness !== undefined);
}

function run(page: Page, scenario: Scenario): Promise<ScenarioOutcome> {
  return page.evaluate((s) => window.__engineHarness!.runScenario(s), scenario);
}

test.describe("image engine (browser + worker)", () => {
  test.beforeEach(async ({ page }) => openHarness(page));

  test("JPEG input → exact-size JPEG output that passes validation", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "noise", width: 800, height: 1000, type: "image/jpeg" } },
      requirements: PHOTO,
    });
    expect(outcome.error).toBeNull();
    const result = outcome.result!;
    expect(result.facts).toMatchObject({ width: 132, height: 170, format: "jpeg" });
    expect(result.blobType).toBe("image/jpeg");
    expect(result.magic.startsWith("ffd8ff")).toBe(true);
    expect(result.source.format).toBe("jpeg");
    expect(result.validation.ready).toBe(true);
    expect(result.validation.checks.map((c) => [c.id, c.status])).toEqual([
      ["dimensions", "pass"],
      ["aspect-ratio", "pass"],
      ["format", "pass"],
      ["file-size", "pass"],
      ["dpi", "pass"],
      ["metadata", "pass"],
    ]);
  });

  test("PNG input → JPEG output", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "opaque", width: 300, height: 300, type: "image/png" } },
      requirements: SIGNATURE,
      samples: [[85, 66]],
    });
    expect(outcome.result?.source.format).toBe("png");
    expect(outcome.result?.facts).toMatchObject({ width: 170, height: 132, format: "jpeg" });
    expectColor(outcome.samples[0].rgba, [200, 30, 30]);
  });

  test("WebP input → JPEG output", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "quadrants", width: 400, height: 400, type: "image/webp" } },
      requirements: SQUARE,
      samples: [
        [10, 10],
        [90, 90],
      ],
    });
    expect(outcome.result?.source.format).toBe("webp");
    expect(outcome.result?.facts.format).toBe("jpeg");
    expectColor(outcome.samples[0].rgba, RED);
    expectColor(outcome.samples[1].rgba, YELLOW);
  });

  test("transparent PNG → white background, content preserved", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "transparent", width: 300, height: 300, type: "image/png" } },
      requirements: SQUARE,
      samples: [
        [5, 5],
        [95, 5],
        [50, 50],
      ],
    });
    expectColor(outcome.samples[0].rgba, WHITE, 8);
    expectColor(outcome.samples[1].rgba, WHITE, 8);
    expectColor(outcome.samples[2].rgba, BLACK, 20);
  });

  test("semi-transparent PNG → composited over white (never black)", async ({ page }) => {
    const outcome = await run(page, {
      input: {
        fixture: { pattern: "semi-transparent", width: 200, height: 200, type: "image/png" },
      },
      requirements: SQUARE,
      samples: [[50, 50]],
    });
    // 50 % blue over white = rgb(127, 127, 255); over black it would be rgb(0, 0, 127).
    expectColor(outcome.samples[0].rgba, [127, 127, 255], 12);
  });

  test("fully opaque PNG → colours unchanged", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "opaque", width: 200, height: 200, type: "image/png" } },
      requirements: SQUARE,
      samples: [[50, 50]],
    });
    expectColor(outcome.samples[0].rgba, [200, 30, 30], 10);
  });

  /**
   * The stored (raw) image has quadrants TL red, TR green, BL blue, BR yellow.
   * Expected colour at the displayed top-left / top-right after orientation.
   */
  const ORIENTATION_CASES: [number, number[], number[]][] = [
    [1, RED, GREEN],
    [2, GREEN, RED],
    [3, YELLOW, BLUE],
    [4, BLUE, YELLOW],
    [5, RED, BLUE],
    [6, BLUE, RED],
    [7, YELLOW, GREEN],
    [8, GREEN, YELLOW],
  ];

  for (const [orientation, topLeft, topRight] of ORIENTATION_CASES) {
    test(`EXIF orientation ${orientation} is corrected before crop/resize`, async ({ page }) => {
      const outcome = await run(page, {
        input: {
          fixture: {
            pattern: "quadrants",
            width: 400,
            height: 400,
            type: "image/jpeg",
            exif: { orientation },
          },
        },
        requirements: SQUARE,
        samples: [
          [15, 15],
          [85, 15],
        ],
      });
      expect(outcome.result?.source.orientation).toBe(orientation);
      expectColor(outcome.samples[0].rgba, topLeft);
      expectColor(outcome.samples[1].rgba, topRight);
    });
  }

  test("EXIF orientation 6 swaps the visual dimensions of a landscape photo", async ({ page }) => {
    const outcome = await run(page, {
      input: {
        fixture: {
          pattern: "quadrants",
          width: 800,
          height: 600,
          type: "image/jpeg",
          exif: { orientation: 6 },
        },
      },
      requirements: PHOTO,
    });
    expect(outcome.result?.source).toMatchObject({ width: 600, height: 800, orientation: 6 });
    expect(outcome.result?.facts).toMatchObject({ width: 132, height: 170 });
  });

  test("exact resize for portrait, landscape and square sources", async ({ page }) => {
    for (const [width, height] of [
      [3000, 4000],
      [4000, 3000],
      [1000, 1000],
      [60, 80], // smaller than target: upscaled to exact size
    ]) {
      for (const requirements of [PHOTO, SIGNATURE]) {
        const outcome = await run(page, {
          input: { fixture: { pattern: "quadrants", width, height, type: "image/jpeg" } },
          requirements,
        });
        expect(outcome.result?.facts, `${width}×${height} → ${requirements.id}`).toMatchObject({
          width: requirements.width,
          height: requirements.height,
        });
      }
    }
  });

  test("aspect-ratio crop: centred by default, focus and zoom move it", async ({ page }) => {
    // Stripes red | green | blue | yellow across a 4:1 image, cropped to a square.
    const input = {
      fixture: { pattern: "stripes" as const, width: 800, height: 200, type: "image/png" as const },
    };
    const samples: [number, number][] = [
      [10, 50],
      [90, 50],
    ];

    const centred = await run(page, { input, requirements: SQUARE, samples });
    expect(centred.result?.crop).toEqual({ x: 300, y: 0, width: 200, height: 200 });
    expectColor(centred.samples[0].rgba, GREEN);
    expectColor(centred.samples[1].rgba, BLUE);

    const left = await run(page, {
      input,
      requirements: SQUARE,
      samples,
      crop: { mode: "auto", focus: { x: 0, y: 0.5 } },
    });
    // Each stripe is 200 px wide, so a left-focused 200×200 crop is entirely red.
    expect(left.result?.crop).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expectColor(left.samples[0].rgba, RED);
    expectColor(left.samples[1].rgba, RED);

    const zoomed = await run(page, {
      input,
      requirements: SQUARE,
      samples,
      crop: { mode: "viewport", center: { x: 0.9, y: 0.5 }, zoom: 2 },
    });
    expect(zoomed.result?.crop.width).toBe(100);
    expectColor(zoomed.samples[0].rgba, YELLOW);
    expectColor(zoomed.samples[1].rgba, YELLOW);
  });

  test("max-KB compression picks the highest quality under the maximum", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "noise", width: 170, height: 132, type: "image/png" } },
      requirements: SIGNATURE, // 5–20 KB; noise at quality 100 is far larger
    });
    const result = outcome.result!;
    expect(result.compression.status).toBe("within_range");
    expect(result.compression.quality).toBeLessThan(100);
    expect(result.compression.attempts).toBeLessThanOrEqual(8);
    expect(result.facts.byteLength).toBeLessThanOrEqual(20_000);
    expect(result.facts.byteLength).toBeGreaterThanOrEqual(5 * 1024);
    expect(result.validation.ready).toBe(true);
  });

  test("already-under-minimum: below_minimum, highest quality kept, no padding", async ({
    page,
  }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "flat", width: 400, height: 300, type: "image/png" } },
      requirements: SIGNATURE,
      samples: [[85, 66]],
    });
    const result = outcome.result!;
    expect(result.compression).toMatchObject({
      status: "below_minimum",
      quality: 100,
      attempts: 1,
    });
    expect(result.compression.message).toContain("not padded");
    expect(result.facts.byteLength).toBeLessThan(5 * 1024);
    expect(result.facts.metadata).toEqual([]); // no filler segments
    expectColor(outcome.samples[0].rgba, [208, 208, 208], 3); // pixels untouched
    const fileSize = result.validation.checks.find((c) => c.id === "file-size");
    expect(fileSize?.status).toBe("fail");
    expect(result.validation.ready).toBe(false);
  });

  test("DPI: output carries the chosen DPI; writeDpi → readDpi round-trips", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "noise", width: 300, height: 400, type: "image/jpeg" } },
      requirements: PHOTO,
    });
    expect(outcome.result?.facts.dpi).toEqual({ x: 150, y: 150 });

    const roundTrip = await page.evaluate(() => window.__engineHarness!.dpiRoundTrip(150));
    expect(roundTrip.before).toBeNull(); // browser encoders write no DPI
    expect(roundTrip.after).toEqual({ x: 150, y: 150 });
    expect(roundTrip.size).toEqual({ width: 40, height: 40 }); // DPI ≠ pixel dimensions
  });

  test("GPS and camera EXIF are removed from the output", async ({ page }) => {
    const outcome = await run(page, {
      input: {
        fixture: {
          pattern: "noise",
          width: 400,
          height: 500,
          type: "image/jpeg",
          exif: {
            orientation: 1,
            gps: true,
            make: "PhoneCo",
            model: "Camera X",
            dateTime: "2026:09:24 10:00:00",
          },
        },
      },
      requirements: PHOTO,
    });
    expect(outcome.input.metadata).toEqual(expect.arrayContaining(["exif", "gps"]));
    expect(outcome.result?.facts.metadata).toEqual([]);
    expect(outcome.result?.validation.checks.find((c) => c.id === "metadata")?.status).toBe("pass");
  });

  test("typical 12 MP phone photo: UI thread stays responsive", async ({ page, browserName }) => {
    const outcome = await run(page, {
      input: {
        fixture: { pattern: "quadrants", width: 3000, height: 4000, type: "image/jpeg" },
      },
      requirements: PHOTO,
    });
    expect(outcome.result?.facts).toMatchObject({ width: 132, height: 170 });
    if (browserName === "firefox") {
      // Known Firefox limitation (see the 6000×8000 test): the decode itself runs on the main
      // thread (~170 ms for 12 MP when idle, more under CPU load). Recorded, not asserted.
      test.info().annotations.push({
        type: "known-limitation",
        description: `Firefox main-thread decode stall: ${outcome.mainThreadMaxGapMs} ms`,
      });
    } else {
      expect(outcome.mainThreadMaxGapMs).toBeLessThan(250);
    }
  });

  test("large 6000×8000 photo: decoded at reduced size, UI thread stays responsive", async ({
    page,
    browserName,
  }) => {
    test.fail(
      browserName === "firefox",
      "Known Firefox limitation: createImageBitmap(Blob) decodes on the main thread even when " +
        "called from a worker, so a 48 MP decode stalls the page for ~0.3–1.5 s. " +
        "See docs/IMAGE_PROCESSING.md (Browser support).",
    );
    test.setTimeout(120_000);
    const outcome = await run(page, {
      input: {
        fixture: { pattern: "quadrants", width: 6000, height: 8000, type: "image/jpeg" },
      },
      requirements: PHOTO,
      samples: [
        [5, 5],
        [126, 164],
      ],
      timeoutMs: 90_000,
    });
    expect(outcome.error).toBeNull();
    const result = outcome.result!;
    expect(result.source).toMatchObject({ width: 6000, height: 8000 });
    expect(result.source.decodedWidth).toBeLessThan(6000);
    expect(result.facts).toMatchObject({ width: 132, height: 170 });
    expectColor(outcome.samples[0].rgba, RED);
    expectColor(outcome.samples[1].rgba, YELLOW);
    expect(outcome.mainThreadMaxGapMs).toBeLessThan(250);
  });

  test("invalid inputs return structured errors (no crash)", async ({ page }) => {
    const svg = [...'<svg xmlns="http://www.w3.org/2000/svg"/>'].map((c) => c.charCodeAt(0));
    const gif = [...Buffer.from("R0lGODlhAQABAAAAACw=", "base64")];
    const cases: [Scenario["input"], string][] = [
      [{ bytes: [], type: "image/jpeg" }, "empty-file"],
      [
        { bytes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], type: "image/jpeg" },
        "unsupported-format",
      ],
      [{ bytes: svg, type: "image/svg+xml" }, "unsupported-format"],
      [{ bytes: gif, type: "image/gif" }, "unsupported-format"],
      // Complete SOI…EOI structure but no quantization tables (WebKit would render it).
      [
        {
          bytes: [
            0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11,
            0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff,
            0xd9,
          ],
          type: "image/jpeg",
        },
        "corrupt-file",
      ],
      [
        {
          fixture: {
            pattern: "noise",
            width: 300,
            height: 300,
            type: "image/jpeg",
            truncateTo: 4000,
          },
        },
        "corrupt-file",
      ],
      [
        {
          fixture: {
            pattern: "noise",
            width: 300,
            height: 300,
            type: "image/png",
            truncateTo: 4000,
          },
        },
        "corrupt-file",
      ],
    ];
    for (const [input, code] of cases) {
      const outcome = await run(page, { input, requirements: PHOTO });
      expect(outcome.ok, code).toBe(false);
      expect(outcome.error?.code).toBe(code);
      expect(outcome.error?.message.length).toBeGreaterThan(10);
      expect(outcome.result).toBeNull();
    }
  });

  test("worker error handling: decoder failure inside the worker is reported", async ({ page }) => {
    // Structurally valid JPEG (SOI, DQT, 12-bit SOF1, DHT, SOS … EOI) that 8-bit browser
    // decoders cannot decode, so the failure happens inside createImageBitmap in the worker.
    const segment = (marker: number, payload: number[]) => [
      0xff,
      marker,
      (payload.length + 2) >> 8,
      (payload.length + 2) & 0xff,
      ...payload,
    ];
    const twelveBit = [
      0xff,
      0xd8,
      ...segment(0xdb, [0x00, ...new Array(64).fill(1)]),
      ...segment(0xc1, [12, 0, 16, 0, 16, 1, 1, 0x11, 0]),
      ...segment(0xc4, [0x00, 1, ...new Array(15).fill(0), 0]),
      ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
      0x12,
      0x34,
      0xff,
      0xd9,
    ];
    const outcome = await run(page, {
      input: { bytes: twelveBit, type: "image/jpeg" },
      requirements: PHOTO,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatchObject({ code: "decode-failed", stage: "loading" });
    expect(outcome.progress).not.toContain("complete");
  });

  test("invalid requirements are rejected with invalid-request", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "flat", width: 50, height: 50, type: "image/png" } },
      requirements: { ...PHOTO, width: 0 },
    });
    expect(outcome.error?.code).toBe("invalid-request");
  });

  /** Runtime requirements as a generic tool builds them (no size/DPI requirement). */
  const runtime = (width: number, height: number, format: "jpeg" | "png" | "webp") => ({
    id: "runtime-test",
    width,
    height,
    fileSizeKB: null,
    fileSizeBytes: null,
    dpi: null,
    formats: [format] as const,
  });

  test("PNG output keeps transparency (no background invented)", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "transparent", width: 300, height: 300, type: "image/png" } },
      requirements: { ...runtime(100, 100, "png"), formats: ["png"] },
      encoding: { format: "png" },
      samples: [
        [5, 5],
        [50, 50],
      ],
    });
    expect(outcome.error).toBeNull();
    expect(outcome.result?.blobType).toBe("image/png");
    expect(outcome.result?.magic).toBe("89504e47");
    expect(outcome.result?.facts).toMatchObject({ width: 100, height: 100, format: "png" });
    expect(outcome.result?.facts.metadata).toEqual([]);
    expect(outcome.result?.compression).toMatchObject({ status: "no_size_limit", quality: null });
    expect(outcome.samples[0].rgba[3]).toBe(0); // transparent corner stays transparent
    expectColor(outcome.samples[1].rgba, BLACK, 20);
    expect(outcome.samples[1].rgba[3]).toBe(255);
    // No size/DPI requirement → those checks are omitted, not faked.
    expect(outcome.result?.validation.checks.map((c) => c.id)).toEqual([
      "dimensions",
      "aspect-ratio",
      "format",
      "metadata",
    ]);
  });

  test("WebP output where the browser can encode it; structured error where it can't", async ({
    page,
  }) => {
    const encodable = await page.evaluate(() => window.__engineHarness!.encodableFormats());
    const outcome = await run(page, {
      input: { fixture: { pattern: "transparent", width: 300, height: 300, type: "image/png" } },
      requirements: { ...runtime(100, 100, "webp"), formats: ["webp"] },
      encoding: { format: "webp", quality: 80 },
      samples: [[5, 5]],
    });
    if (encodable.webp) {
      expect(outcome.result?.blobType).toBe("image/webp");
      expect(outcome.result?.facts).toMatchObject({ width: 100, height: 100, format: "webp" });
      expect(outcome.samples[0].rgba[3]).toBe(0);
    } else {
      expect(outcome.error).toMatchObject({ code: "unsupported-output-format", stage: "encoding" });
    }
  });

  test("fixed quality without a size limit: one encode at the requested quality", async ({
    page,
  }) => {
    const sizes: number[] = [];
    for (const quality of [40, 95]) {
      const outcome = await run(page, {
        input: { fixture: { pattern: "noise", width: 800, height: 600, type: "image/png" } },
        requirements: { ...runtime(400, 300, "jpeg"), formats: ["jpeg"] },
        encoding: { format: "jpeg", quality },
      });
      expect(outcome.result?.compression).toMatchObject({
        status: "no_size_limit",
        quality,
        attempts: 1,
      });
      expect(outcome.result?.facts).toMatchObject({ width: 400, height: 300, format: "jpeg" });
      sizes.push(outcome.result!.facts.byteLength);
    }
    expect(sizes[0]).toBeLessThan(sizes[1]);
  });

  test("byte limit is enforced on actual output bytes (1 KB = 1024 bytes)", async ({ page }) => {
    const maxBytes = 200 * 1024;
    const outcome = await run(page, {
      input: { fixture: { pattern: "noise", width: 1200, height: 900, type: "image/png" } },
      requirements: {
        ...runtime(1200, 900, "jpeg"),
        formats: ["jpeg"],
        fileSizeBytes: { minBytes: 0, maxBytes },
      },
      encoding: { format: "jpeg" },
    });
    const result = outcome.result!;
    // Pure noise can't reach 200 KB at 1200×900 even at the lowest quality: reported, not hidden.
    expect(result.compression.status).toBe("above_maximum");
    expect(result.facts.byteLength).toBeGreaterThan(maxBytes);
    expect(result.validation.checks.find((c) => c.id === "file-size")?.status).toBe("fail");

    const reachable = await run(page, {
      input: { fixture: { pattern: "quadrants", width: 1200, height: 900, type: "image/png" } },
      requirements: {
        ...runtime(1200, 900, "jpeg"),
        formats: ["jpeg"],
        fileSizeBytes: { minBytes: 0, maxBytes: 20 * 1024 },
      },
      encoding: { format: "jpeg" },
    });
    expect(reachable.result!.compression.status).toBe("within_range");
    expect(reachable.result!.facts.byteLength).toBeLessThanOrEqual(20 * 1024);
    expect(reachable.result!.validation.ready).toBe(true);
  });

  test("progress events arrive in pipeline order", async ({ page }) => {
    const outcome = await run(page, {
      input: { fixture: { pattern: "noise", width: 500, height: 500, type: "image/jpeg" } },
      requirements: PHOTO,
    });
    expect(outcome.progress).toEqual([
      "loading",
      "orientation",
      "cropping",
      "resizing",
      "encoding",
      "dpi",
      "metadata",
      "validation",
      "complete",
    ]);
  });
});
