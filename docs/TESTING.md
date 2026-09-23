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
- E2E: every tool page renders one h1, canonical, JSON-LD; requirements rendered from preset; sitemap/robots; exam search; no horizontal scroll on mobile.

## Required before the pipeline ships

Tracked as `it.todo` in `src/lib/image/pipeline.test.ts`:
portrait, landscape, square, JPG, PNG, EXIF rotation, huge image, invalid image,
file-size boundaries, exact dimensions, DPI, output format.

Pipeline tests run in a real browser (Playwright, or Vitest browser mode if added later)
because they need canvas/`createImageBitmap`. Each asserts on the **output bytes** via
`detectImageFormat`, a JFIF density reader, and decoded dimensions.

## Rules

- Compression tests must be deterministic: inject an encoder or assert ranges, never exact bytes from a real browser encoder.
- Any change to a preset changes its test in the same commit.
- A bug fix comes with a test that fails without it.
