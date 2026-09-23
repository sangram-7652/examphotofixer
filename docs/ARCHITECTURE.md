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
  config/site.ts       Brand, canonical URL, indexing switch.
  lib/
    presets/           Single source of truth for official requirements (+ source metadata).
    image/             Framework-free image logic: formats, geometry, size targeting, DPI, limits,
                       pipeline contract. No React, no Next imports.
    validation/        Framework-free validation model (checks → report).
    tools/registry.ts  Tool definitions (route, presets, SEO copy). Drives pages, nav, sitemap.
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
File ─▶ checkInputFile ─▶ pipeline (lib/image, in a Web Worker) ─▶ OutputFacts
                                                                   │
                         preset (lib/presets) ────────────────────▶ validateAgainstPreset ─▶ ValidationReport ─▶ UI checklist
```

## Key decisions

| Decision                              | Reason                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Local-only processing                 | Privacy, zero server cost, works on slow networks after load.                                                  |
| Presets as data, not UI               | One place to update when an exam body changes rules; testable.                                                 |
| Tool registry                         | Routes, navigation, internal links and sitemap stay in sync.                                                   |
| Static pages                          | Fast first load, cheap hosting, good Core Web Vitals.                                                          |
| Pipeline in a Web Worker (next phase) | Keeps UI responsive on large images; `OffscreenCanvas` + `createImageBitmap`.                                  |
| No image libraries yet                | Browser canvas + small custom JFIF writer should suffice; add a dependency only if a test proves it necessary. |

## Adding a tool

1. Add/verify presets in `src/lib/presets/` (with source metadata).
2. Add an entry to `TOOLS` in `src/lib/tools/registry.ts`.
3. Add `src/app/<path>/page.tsx` rendering `<ToolPage toolId=… />`.
4. `src/lib/seo/seo.test.ts` fails if the route file is missing.
