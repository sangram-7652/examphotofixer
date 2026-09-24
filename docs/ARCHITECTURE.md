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

## Complete Pack (P5)

`PackTool` renders one standard `ImageTool` per preset (heading level 3) and listens to each
through `onStatusChange` (`{ state, hasError, output }`). No processing, crop or validation code
is duplicated. `lib/tools/pack-state.ts` maps tool states to asset states
(`EMPTY · SELECTED · PROCESSING · READY · READY_WITH_WARNING · INVALID · ERROR`) and derives the
pack state (`EMPTY · IN_PROGRESS · READY · READY_WITH_WARNING · INCOMPLETE`): READY only when all
assets are READY; READY_WITH_WARNING when all are downloadable and one has a warning;
INCOMPLETE when any asset is INVALID/ERROR.

"Download All" builds a ZIP on click with `lib/zip/zip.ts` — a ~100-line STORE-only writer
(JPEGs don't compress further) with CRC-32; entries are the engine's final bytes. No
dependency was added. "Start again" remounts the tools (their cleanup revokes object URLs) and
revokes the ZIP URL. Assets are processed only when the user presses each Process button.

## Verified presets vs runtime requirements (P6)

```
                    Image engine (one worker, one pipeline)
                                 ↑  OutputRequirements + EncodingOptions
              ┌──────────────────┴──────────────────┐
     Verified presets (lib/presets)        Runtime settings (lib/tools/generic)
     CCC tools, source-cited               Image Resizer, Image Compressor
```

- Presets are never used by generic tools, and generic settings never become presets.
  `lib/tools/generic/resize.ts` and `compress.ts` turn user settings into
  `OutputRequirements` (`fileSizeKB: null`, optional exact `fileSizeBytes`, `dpi: null`,
  one output format) plus `EncodingOptions`.
- UI: `components/tool/generic/ImageResizerTool` and `ImageCompressorTool` reuse
  `ImageUploader`, `Cropper`, `ProcessingProgress`, `ValidationChecklist`, `ResultPreview`
  and `DownloadButton`. Shared client plumbing (`components/tool/image-job.ts`): file
  inspection, object-URL registry, one-job-at-a-time runner with lazy engine import.
  `ImageTool` uses the same file inspection.
