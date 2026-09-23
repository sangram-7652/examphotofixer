# Testing

## Commands

| Command                             | What                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `npm test`                          | Vitest unit tests (Node environment)                                        |
| `npm run test:watch`                | Vitest watch mode                                                           |
| `npm run build && npm run test:e2e` | Playwright against the production build (port 4310, `E2E_PORT` to override) |
| `npm run check`                     | lint + typecheck + format check + unit tests                                |

First-time Playwright setup: `npx playwright install chromium`.

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

## Rules

- Compression tests must be deterministic: inject an encoder or assert ranges, never exact bytes from a real browser encoder.
- Any change to a preset changes its test in the same commit.
- A bug fix comes with a test that fails without it.
