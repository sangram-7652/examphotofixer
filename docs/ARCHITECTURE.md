# Architecture

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
ESLint 9 (flat config, `eslint-config-next`) · Prettier 3 · Vitest 5 · Playwright.

All pages are statically prerendered. There is no backend, database, auth or API route in V1.

## Layers

```
src/
  app/                 Routes only: metadata + composition. No business logic.
  components/          Presentational React. Reads presets/tools; never hard-codes requirements.
    tool/              Reusable tool UI driven by a preset: ImageTool (state machine),
                       ImageUploader, Cropper, ProcessingProgress, ValidationChecklist,
                       ResultPreview, DownloadButton, RequirementsSummary.
  content/             Editorial page content (intro, how-to, problems, FAQ) built from presets.
  config/site.ts       Brand, canonical URL, indexing switch.
  lib/
    presets/           Single source of truth for official requirements (+ source metadata).
    image/             Image engine: pure byte/geometry modules, engine.ts (canvas), and
                       worker/ (typed protocol, worker entry, main-thread client).
                       No React, no Next imports.
    validation/        Framework-free validation model (checks → report).
    tools/             registry.ts (route, presets, status, SEO copy) plus UI logic: result
                       state, checklist rows, progress steps, error wording, cropper view math,
                       download filenames.
    analytics/         Provider-independent `track()` hooks (no provider installed).
    seo/               Metadata builder, JSON-LD builders, route list for sitemap.
e2e/                   Playwright browser tests.
docs/                  Product and technical documentation.
```

### Dependency direction

`app → components → lib/*`. Inside `lib`: `validation → image → presets/types`.
`lib/image` and `lib/validation` must never import React, Next.js, or anything from
`components`/`app`. This keeps processing testable in Node and movable into a Web Worker.

## Data flow (target)

```
File ─▶ processImage (client) ─▶ image.worker ─▶ runImagePipeline ─▶ OutputFacts
                                                                   │
                         preset (lib/presets) ────────────────────▶ validateAgainstPreset ─▶ ValidationReport ─▶ UI checklist
```

## Key decisions

| Decision                 | Reason                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Local-only processing    | Privacy, zero server cost, works on slow networks after load.                                                    |
| Presets as data, not UI  | One place to update when an exam body changes rules; testable.                                                   |
| Tool registry            | Routes, navigation, internal links and sitemap stay in sync.                                                     |
| Static pages             | Fast first load, cheap hosting, good Core Web Vitals.                                                            |
| Pipeline in a Web Worker | Keeps UI responsive on large images; `OffscreenCanvas` + `createImageBitmap`. One worker per job.                |
| No image libraries       | Canvas plus small byte-level JPEG code (EXIF, JFIF, stripping) covers everything; no runtime dependencies added. |

## Adding a tool

1. Add/verify presets in `src/lib/presets/` (with source metadata).
2. Add an entry to `TOOLS` in `src/lib/tools/registry.ts`.
3. Add `src/app/<path>/page.tsx` rendering `<ToolPage toolId=… />`.
4. `src/lib/seo/seo.test.ts` fails if the route file is missing.

## Tool UI (P3)

`ToolPage` (server) renders a tool from the registry. When `tool.status === "live"` it mounts
`<ImageTool preset={…} />` (client); other tools keep the placeholder. Adding the signature or
thumb tool means setting its status to `live` and adding content in `src/content/tool-content.ts`,
with no component changes.

`ImageTool` states: `SELECT → CROP → PROCESSING → READY | READY_WITH_WARNING | INVALID`, or
`ERROR`. `READY_WITH_WARNING` is used when the only unmet condition is `below_minimum` file size;
the download stays available ("Download Anyway"). `INVALID` hides the download.

- The engine client is loaded with `import()` when a photo is selected; the worker starts on
  "Process". The initial page carries only the UI (~11 KB gzip).
- Crop: the cropper produces a `viewport` `CropSpec`; its layout uses the engine's
  `resolveCropRect`, so crop maths exists in one place.
- Validation: the checklist maps the engine's `ValidationReport`; the UI never re-checks values.
- Object URLs are tracked by `ImageTool` and revoked on "Start again" and unmount. Blobs live in
  component state only.
