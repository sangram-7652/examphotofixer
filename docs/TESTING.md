# Testing

## Commands

| Command                             | What                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                          | Vitest unit tests (Node environment)                                                                                            |
| `npm run test:watch`                | Vitest watch mode                                                                                                               |
| `npm run build && npm run test:e2e` | Playwright against the production build (port 4310, `E2E_PORT` to override) on Chromium, Firefox, WebKit and a Pixel 7 viewport |
| `npm run check`                     | lint + typecheck + format check + unit tests                                                                                    |

First-time Playwright setup: `npx playwright install chromium firefox webkit`. On Linux, WebKit
also needs host libraries: `sudo npx playwright install-deps webkit` (CI: use
`npx playwright install --with-deps`). Run a subset with
`npx playwright test --project=chromium --project=firefox`.

**WebKit from a VS Code Snap terminal.** The Snap exports `GIO_MODULE_DIR`, `GTK_PATH`,
`LOCPATH` etc.; WebKit's network process then loads Snap GIO modules built against an older
glibc and every navigation fails with "WebKit encountered an internal error". Run WebKit with
those variables unset, e.g.
`env -u GIO_MODULE_DIR -u GTK_PATH -u GTK_EXE_PREFIX -u GTK_IM_MODULE_FILE -u LOCPATH -u GSETTINGS_SCHEMA_DIR npx playwright test --project=webkit`,
or from a normal terminal.

**WebKit without sudo (local only).** If `install-deps` isn't possible, the missing libraries
can be fetched with `apt-get download` (libavif16, libdav1d7, libgav1-2, libyuv0,
libevent-2.1-7t64, libflite1, libmanette-0.2-0, libhidapi-hidraw0, libbacktrace0), extracted
with `dpkg-deb -x` into a scratch folder and loaded via `LD_PRELOAD` (the WebKit wrapper resets
`LD_LIBRARY_PATH`) with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`. This is how the P4
WebKit run was done; CI must install dependencies properly.

## Layout

- Unit tests: colocated `src/**/*.test.ts`.
- E2E: `e2e/*.spec.ts`, projects `mobile-chrome` (Pixel 7, primary) and `desktop-chrome`.
- Fixtures: `tests/fixtures/` (see README there; synthetic images only).

## Current coverage

- Presets: consistency, CCC values, verified ⇒ URL + date, planned exams have no presets.
- Tool registry: presets exist, unique ids/paths; every route has a page file.
- Geometry: portrait/landscape/square crops, focus clamping, EXIF dimension swap, pixel budget.
- Size targeting: KB→bytes, deterministic quality search (fits, too large, too small, unreachable, boundaries, call budget).
- Format sniffing: JPEG/PNG/WebP/GIF/BMP/HEIC/unknown/truncated.
- DPI choice.
- Validation: pass, each failure, exact byte boundaries, DPI bounds/missing, processing error, input pre-flight.
- JSON-LD escaping.
- E2E (smoke): every tool page renders one h1, canonical, JSON-LD; requirements rendered from preset; sitemap/robots; exam search; no horizontal scroll on mobile.

## Image engine tests

**Unit (Node, Vitest)**: byte-level and pure logic, using synthetic JPEGs and EXIF built by
`src/lib/image/testing/` (no binary fixtures): `jpeg.test.ts` (segments, EOI, DPI write/read
150, metadata listing/stripping incl. GPS, image data unchanged), `exif.test.ts` (orientation
1–8, GPS, big-endian), `orientation.test.ts` (all 8 transforms against hand-written
expectations), `crop.test.ts`, `resize.test.ts`, `size-target.test.ts` (search, statuses,
boundaries), `formats.test.ts` (APNG, animated WebP, truncation), `worker/client.test.ts`
(fake worker: progress, errors, crash, timeout, abort).

**Browser (Playwright, `e2e/image-engine.spec.ts`)**: the real worker from the production
build, driven through `/dev/image-engine`. Fixtures are drawn deterministically in the page
(canvas patterns, seeded noise, injected EXIF). Covers JPEG/PNG/WebP input; transparent,
semi-transparent and opaque PNG; invalid files (empty, random, SVG, GIF, truncated JPEG/PNG);
EXIF orientations 1–8; exact resize (portrait/landscape/square/upscale); aspect-ratio crop
(centre, focus, zoom); max-KB compression; below-minimum; DPI; GPS removal; a 6000×8000 photo
with main-thread stall < 250 ms; worker decode errors; progress order; final validation.
Colour checks sample output pixels with a tolerance (JPEG is lossy).

The harness page returns 404 unless the server runs with `ENGINE_HARNESS=1`; Playwright's
`webServer` sets it. Never set it in production.

## Tool UI tests

**Unit**: `src/lib/tools/tool-ui.test.ts` (filenames from presets, READY / READY_WITH_WARNING /
INVALID mapping, checklist rows, progress-step mapping, error wording, live tools, content built
from preset values), `cropper.test.ts`, `analytics.test.ts`.

**Browser (`e2e/ccc-photo-tool.spec.ts`)**: page load and requirement values; upload; crop (drag,
zoom buttons and slider, keyboard, reset); real progress (a MutationObserver records every
rendered stage and asserts pipeline order); READY checklist; previews; download (event, filename,
bytes re-validated with `readJpegFacts`); start again; below-minimum warning + "Download Anyway";
unsupported and damaged files; PNG input; no non-GET requests (nothing uploaded); analytics
events; mobile first-screen CTA, touch target size, no horizontal scroll, previews not
overlapping captions. Images are generated in the page; waits are on `data-state`, never timers.

**Source verification**: `ccc-photo-tool.spec.ts` asserts the "Source and verification" section
cites "NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)", shows the verified
date, links to the PDF with `target="_blank"` and `rel="noopener noreferrer"`, and that no
sentence on the page claims affiliation or approval.

**Known limitation marks**: `image-engine.spec.ts` marks the 48 MP responsiveness test
`test.fail` on Firefox and records (not asserts) the Firefox stall for 12 MP, because Firefox
decodes on the main thread (see IMAGE_PROCESSING.md). All other assertions run on every browser.

## Rules

- Compression tests must be deterministic: inject an encoder or assert ranges, never exact bytes from a real browser encoder.
- Any change to a preset changes its test in the same commit.
- A bug fix comes with a test that fails without it.
