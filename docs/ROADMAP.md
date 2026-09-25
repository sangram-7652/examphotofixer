# Roadmap

## Phase 0 — Foundation ✅ (this phase)

Project setup, presets with source metadata, tool registry, SEO skeleton, validation model,
pure image helpers (geometry, size search, DPI choice, format sniffing), test infrastructure, docs.

## Phase 1 (P2): Image engine ✅

Web Worker engine: decode, EXIF orientation 1–8, crop (auto/rect/viewport), stepped resize,
white background, JPEG encode, KB search, JFIF DPI, metadata stripping, validation, typed
progress and errors. Below-minimum decision locked: report it, never pad. Unit and browser tests.

## Phase 2 (P3): Tool UI, CCC Photo ✅

Reusable preset-driven tool UI (upload, crop, real progress, checklist, preview, download, reset),
`/ccc-photo-resizer` live with full content and FAQ, analytics hooks, Chromium/Firefox/WebKit
e2e projects. Next: turn on `/ccc-signature-resizer` and `/ccc-thumb-impression-resizer`
(status + content only), then the CCC Complete Pack and generic tools.

## Phase 2.5 (P4): Hardening ✅

Official CCC source recorded (NIELIT guidelines Version 1.11 (2023), page 3, SHA-256) with a
Source & verification section; guidance from the source shown; WebKit run and passing; JPEG
integrity check hardened (DQT required) after a WebKit difference.

## Phase 2.6 (P5): All CCC tools ✅

`/ccc-signature-resizer`, `/ccc-thumb-impression-resizer` and `/ccc-complete-pack` (three
steps, pack status, local ZIP) live on the shared tool architecture.

## Phase 2.7 (P6): Generic tools ✅

`/image-resizer` (crop/fit, JPG/PNG/WebP, quality) and `/image-compressor` (maximum size,
actual-byte enforcement) on the same engine via runtime requirements.

## Phase 2.8 (P7): SEO & content system ✅

Guide system with four CCC guides, real `/guides` index, related guides on tools, robots/sitemap/
canonical/404 audit with raw-HTML e2e checks, Search Console docs, SEO audit.

## Phase 2.9 (P8): First non-CCC verified preset ✅

IBPS photograph (`/ibps-photo-resizer`, `/guides/ibps-photo-size`) from the CRP RRBs XV
notification, with a full audit trail in `EXAM_REQUIREMENT_VERIFICATION.md`. Next candidates:
IBPS signature/thumb/declaration (already verified in the same annexure), then others only after
official verification.

## Phase 3 — Launch

- P9: search data and conversion analytics foundation (no provider). ✅
- P10: production hardening — security headers and CSP (`connect-src 'self' blob:`), launch smoke
  check (`npm run smoke`), launch-mode robots/sitemap gates, deployment, rollback and launch
  checklist docs. Code ready; not deployed. ✅
- Remaining (owner): legal review, contact address, hosting + domain + DNS, production env,
  live smoke test, Search Console. Analytics provider decision. See
  `PRODUCTION_LAUNCH_CHECKLIST.md`.

## Phase 4 — Growth

- Guides that solve real rejection problems, linked to tools.
- Next exams (SSC, Railway, UPSC) — only after requirements are verified from official notices.
- Document tools (PDF size/compress) — later.

## Explicitly not planned for V1

Auth, database, payments, admin panel, AI features, server-side processing.
