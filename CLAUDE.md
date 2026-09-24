@AGENTS.md

# ExamPhotoFixer — Project Guide

**ExamPhotoFixer** · "Fix it before you upload." · Exam & Application File Tools.
India-focused web tools that prepare photos, signatures and thumb impressions for online
exam/application uploads. Mobile-first. Current phase: see `docs/ROADMAP.md`.

Read `docs/` before non-trivial work: PRD, ARCHITECTURE, IMAGE_PROCESSING, VALIDATION,
FORM_PRESETS, SEO_STRATEGY, SEO_URL_MAP, ANALYTICS, TESTING, PRIVACY, DEPLOYMENT, ROADMAP.

## Architecture rules

- `src/app` = routes (metadata + composition). `src/components` = presentation.
  `src/lib` = logic. Dependency direction: app → components → lib.
- `src/lib/image` and `src/lib/validation` are framework-free: no React, no Next.js,
  no DOM-only globals at module top level. They must run in Node (tests) and a Web Worker.
- Tools are defined once in `src/lib/tools/registry.ts`; routes, nav, related links and
  sitemap derive from it. Adding a tool = registry entry + `src/app/<path>/page.tsx`.
- V1 has **no** auth, database, payments, admin panel, API routes or AI features. Do not add them.
- Do not add dependencies without a concrete need that the platform can't meet; justify in the PR.

## Government requirement rules (critical)

- Requirement numbers live **only** in `src/lib/presets/`. Never hard-code a width, height,
  KB, DPI or format in components, pages, copy, or tests other than the preset test.
- **Never invent requirements.** No guessing, no values from blogs or memory. If a value is
  unknown, leave the exam `planned` with no presets.
- Every preset carries `source` (authority, document, url, version, verifiedOn, status).
  Never fabricate a source URL; use `null` until a real one is recorded.
- `status: "verified"` requires an https `url`, `verifiedOn`, `document`, `version` and
  `published` (enforced by tests). Record `page` and `sha256` so re-verification is mechanical.
- Values belong to a document version. Older versions of the same guidelines can differ; never
  show values without their version/date, and update `source` with the numbers.
- Reference sources, never imply endorsement: no "official", "approved by" or "affiliated" claims.
- Changing a preset value requires the official source in the same change and an updated test.
- UI must show the source and remind users to check the official notification.

## Image-processing rules

- All processing is local in the browser. Never upload or persist user images.
- Never stretch: crop to target aspect ratio (`computeCoverCrop`), then scale uniformly.
- Correct EXIF orientation before cropping.
- Heavy work runs in the image worker. UI code uses only `src/lib/image/worker/client.ts`
  (`processImage`), never the engine or worker directly.
- `lib/image` stays generic: it takes `OutputRequirements`, never exam names or preset ids.
- Size targeting: highest quality whose final bytes fit the maximum (`findQualityForByteWindow`).
- Below minimum at max quality → return `below_minimum`. Never pad, add noise or alter pixels
  to inflate size (locked product decision).
- KB window: min × 1024, max × 1000 bytes (`kbRangeToByteWindow`).
- Guard huge inputs (`MAX_INPUT_BYTES`, `MAX_INPUT_PIXELS`, `MAX_CANVAS_PIXELS`).
- Detect formats from magic bytes, not extension/MIME.
- Validate the **final bytes**, not intended settings. Fail with specific, actionable messages.
- Strip EXIF/GPS from outputs (`finalizeJpeg`); image data is copied byte-for-byte.

## Coding rules

- TypeScript strict; no `any`; prefer pure functions and explicit types at module boundaries.
- Server Components by default; `"use client"` only where interaction needs it.
- Tailwind with theme tokens from `globals.css` (`bg-brand`, `text-muted`, …) — no raw hex in components.
- Accessible by default: labels for inputs, one `h1` per page, landmarks, visible focus.
- Prettier formatting (100 cols, double quotes). Match surrounding style and comment density.
- Next.js 16: consult `node_modules/next/dist/docs/` for APIs (see AGENTS.md).

## Tool UI rules

- Tool UI lives in `src/components/tool/` and is driven by a preset; no exam-specific components.
  Exam-specific wording belongs in `src/content/tool-content.ts`, built from preset values.
- A tool goes live via `status: "live"` in the registry; `ToolPage` then mounts `ImageTool`
  (single preset) or `PackTool` (pack). Coming-soon tools are noindex and not in the sitemap.
- Packs compose `ImageTool`s via `onStatusChange`; never add per-document uploaders/croppers.
- Never duplicate engine logic in React: crop geometry via `resolveCropRect` (see
  `lib/tools/cropper.ts`), pass/fail from the engine's `ValidationReport`.
- `below_minimum` is a warning (`READY_WITH_WARNING`), never an error; download stays available.
- Load the engine lazily (`import("@/lib/image/worker/client")`); keep Blobs/URLs in component
  state and revoke URLs on reset/unmount.
- Status must never rely on colour alone; announce state changes via the live region.
- Analytics via `track()` only; no file names or image-derived data.

## SEO rules

- Metadata via `buildPageMetadata` (canonical, OG, Twitter). Titles use the root template.
- JSON-LD via `src/lib/seo/json-ld.ts` + `<JsonLd>` (escapes `<`). Only schema that matches visible content.
- New indexable routes go into the registry/`routes.ts` so the sitemap stays correct.
- No thin or programmatic pages. Placeholder pages are `noIndex` and out of the sitemap.
- Indexing is off unless `NEXT_PUBLIC_SITE_INDEXABLE=true`. URLs never change without a 301.

## Testing rules

- Unit: Vitest, colocated `*.test.ts`. E2E: Playwright in `e2e/` (mobile project first).
- Compression tests are deterministic (injected encoder or range assertions).
- Engine browser tests: `e2e/image-engine.spec.ts` via the `/dev/image-engine` harness
  (enabled only when the server runs with `ENGINE_HARNESS=1`). Generate fixtures in-page; no network.
- Bug fixes include a failing-first test. Preset changes update `presets.test.ts`.

## Privacy rules

- No network calls carrying file data. No third-party scripts on tool pages beyond approved analytics.
- Analytics never includes file names, contents or image-derived data (docs/ANALYTICS.md).

## Development workflow

```
npm run dev          # local dev
npm run lint         # ESLint
npm run typecheck    # next typegen + tsc
npm test             # Vitest
npm run build        # production build
npm run test:e2e     # Playwright (after build; npx playwright install chromium once)
npm run format       # Prettier write
npm run check        # lint + typecheck + format:check + test
```

Before finishing any task: lint, typecheck, test, build — report results honestly.
Don't commit unless asked. Don't modify unrelated files.
