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

**Launch mode.** The default e2e build is pre-launch (noindex, robots `Disallow: /`), and
`e2e/launch.spec.ts` checks exactly that. To check the launch gates (robots allows `/`, sitemap
on the canonical origin, `/dev/` disallowed, no noindex), build and test with:

```
NEXT_PUBLIC_SITE_INDEXABLE=true NEXT_PUBLIC_SITE_URL=https://examphotofixer.com npm run build
E2E_LAUNCH=1 npx playwright test e2e/launch.spec.ts e2e/seo.spec.ts e2e/smoke.spec.ts --project=chromium
```

Rebuild without those variables before the regular e2e run. `npm run smoke -- <url>` runs the
same gates against any running server or the live site (see `DEPLOYMENT.md`).

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

## CCC tools and Complete Pack (P5)

Shared helpers live in `e2e/helpers.ts` (in-page image generation, uploads, analytics capture,
non-GET request recording, overflow check, download bytes).

- `e2e/ccc-signature-thumb.spec.ts` runs the same flow for signature and left thumb: page
  (H1, preset values, guidance, source link, pack link, canonical, no extra noindex), upload,
  crop, process, READY checklist, download (filename + bytes re-validated), start again,
  below-minimum warning with Download Anyway, mobile layout and neutral camera wording.
- `e2e/ccc-complete-pack.spec.ts`: three steps with their own requirements; valid pack; ZIP
  entries equal the individual downloads byte-for-byte; warning pack; incomplete pack (a
  rejected file blocks Download All and is named); start again clears everything; no
  non-GET requests; analytics; mobile layout. WebKit pack tests are marked `test.slow()`
  (three images per test; headless WebKit encodes ~6× slower than Chromium). An INVALID asset
  can't be produced with real CCC inputs (the engine always meets dimensions/format/DPI), so
  INVALID is covered by `pack.test.ts` and `tool-ui.test.ts`.
- Unit: `lib/zip/zip.test.ts` (CRC vs `node:zlib`, round-trip with an independent reader, and
  Python `zipfile.testzip()` when Python is available), `lib/tools/pack.test.ts`.

## Generic tools (P6)

- Unit: `lib/tools/generic/resize.test.ts` (defaults, lock, crop/fit, formats, transparency,
  validation, filenames, engine limits), `compress.test.ts` (presets in KiB, custom maximum,
  window capped at the original, byte enforcement on encoder output incl. the 500 × 1024
  boundary, impossible limits, outcomes, saved %, filenames), PNG/WebP metadata stripping in
  `formats.test.ts`.
- Engine (browser): PNG output keeps alpha; WebP output or `unsupported-output-format`;
  fixed quality = one encode; byte limits on actual output (reachable and impossible).
- `e2e/image-resizer.spec.ts` / `image-compressor.spec.ts`: meta/canonical/OG/H1, FAQ equals
  its JSON-LD, upload details, lock/unlock, crop/fit, formats, transparency, download read back
  with `readOutputFacts` (compressor asserts `bytes <= limit × 1024`), impossible and
  larger-than-original states without a download, reset, unsupported input, mobile, no non-GET
  requests, analytics. Processing waits allow 30 s (large images, slow headless WebKit encoder).

## SEO and guides (P7)

- Unit: `content/guides.test.ts` (registry, slugs, unique metadata, live tool links, values from
  presets incl. change propagation, no approval/guarantee claims), `lib/seo/seo-rules.test.ts`
  (sitemap inclusion/exclusion, noindex rules, canonicals, host), `app/robots.test.ts`.
- `e2e/guides.spec.ts` (all projects): index, each guide's H1/meta/canonical/OG, preset values,
  source, tool links, guide ↔ tool navigation, phone layout.
- `e2e/seo.spec.ts` (Chromium only — HTTP, no browser): exact sitemap list; for every sitemap
  URL on **raw server HTML**: 200, one self canonical, title, description, OG, one H1, no extra
  noindex, one valid JSON-LD block, no duplicate/forbidden schema types, FAQ schema = visible FAQ;
  crawl of all internal links (200, no redirects); robots, 308 redirects, trailing slash, 404s.

## Rules

- Compression tests must be deterministic: inject an encoder or assert ranges, never exact bytes from a real browser encoder.
- Any change to a preset changes its test in the same commit.
- A bug fix comes with a test that fails without it.

## Production launch (P10)

- Unit: `config/security-headers.test.ts` (CSP directives: `connect-src 'self' blob:`, worker and
  blob sources only, no wildcard, no `unsafe-eval` in production; header set; www↔apex
  redirect), `config/site.test.ts` (origin, indexable flag, contact address validation),
  `lib/launch/smoke.test.ts` (robots, sitemap, page and header gates, including failing cases
  such as an accidental global `Disallow: /`, preview-host sitemaps and redirect chains).
- `e2e/launch.spec.ts`: the smoke gate against the served build (pre-launch or `E2E_LAUNCH=1`);
  every tool type processes and downloads with zero CSP violations and no cookies set;
  `/privacy` states only implemented behaviour.
- `e2e/accessibility.spec.ts`: keyboard-only processing and download with visible focus,
  focus moved to the result, live-region announcement; home exam chip by keyboard.
- Launch audits run by hand (not committed, see `DEPLOYMENT.md` → "Launch audit results"):
  axe-core WCAG 2.2 A/AA on every page and result state; lab page-load timings.

## Growth foundation (P11)

- Unit: `search-data/intent.test.ts` (every intent label, determinism, registry exam names,
  spec extraction), `search-data/opportunities.test.ts` (inventory from registries; each
  opportunity rule incl. threshold, verification-only paths for planned/unknown exams and
  requirement mismatches, fixture yields no proposals), `analytics/report.test.ts` (NDJSON
  parsing, accepted-only selections, READY vs warning, sample gating, reason codes, engagement).
  Requirement numbers in these tests come from presets.
- `e2e/smoke.spec.ts`: the homepage lists every live exam tool in its exam's section (failed
  on the P10 homepage for `ibps-photo` before the fix).

## Requirement monitoring and IBPS documents (P12)

- Unit: `requirements/requirements.test.ts` (every preset equals its latest verified snapshot;
  history matches source metadata and is append-only; superseded versions kept; REVIEW_DUE after
  90 days without touching values; change impact; checksum UNCHANGED/CHANGED/unknown; the
  generated table in `docs/REQUIREMENT_MONITORING.md` matches the code for its "as of" date).
  `presets.test.ts`: exact IBPS signature/left thumb/declaration values, shared frozen source,
  cited pages.
- `e2e/ibps-documents.spec.ts`: each new IBPS tool (page, requirements and guidance from the
  preset, source with pages, pack link listing four documents, no claims; READY download
  re-validated incl. EXIF/GPS stripped and nothing uploaded; below-minimum warning; mobile) and
  the IBPS Complete Pack (four steps, shared source citing pages 56–58, ZIP with four validated
  files, analytics without file data).
