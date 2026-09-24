# SEO Strategy

## Principles

- One page per real user task (tool), with real requirements content — **no thin programmatic pages**.
- A page for an exam exists only when we have verified presets and a working tool for it.
- Mobile-first, fast (static prerender, no client JS except the tool and search).
- Accuracy is the ranking moat: show requirements with their source and last-checked date.

## Implemented

| Item                                  | Where                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Per-page title/description            | `buildPageMetadata` (`src/lib/seo/metadata.ts`), copy in tool registry                   |
| Title template `%s \| ExamPhotoFixer` | root layout                                                                              |
| Canonical URLs                        | `alternates.canonical` + `metadataBase` from `NEXT_PUBLIC_SITE_URL`                      |
| Open Graph / Twitter                  | `buildPageMetadata`                                                                      |
| Sitemap                               | `src/app/sitemap.ts` from `listSiteRoutes()` (placeholder pages excluded)                |
| robots.txt                            | `src/app/robots.ts` — **disallow all until `NEXT_PUBLIC_SITE_INDEXABLE=true`**           |
| Page-level noindex                    | root layout when not indexable; `/guides` always until it has content                    |
| Structured data                       | `WebSite` (home), `WebApplication` + `BreadcrumbList` (tools), `BreadcrumbList` (/tools) |
| Semantic HTML                         | one `h1`, `nav` landmarks, breadcrumb `nav`, `th scope` tables — asserted in e2e         |
| Internal linking                      | footer → all tools; tool page → related tools of same exam; home → tools                 |

## Internal linking architecture

```
Home ──▶ exam hubs (/ccc-complete-pack) ──▶ individual tools
  │                         ▲                        │
  └──▶ /tools (all) ────────┘◀── related tools ◀──────┘
Guides (future) ──▶ tools they explain
```

## Next

- OG images per tool (`opengraph-image.tsx`) once branding is final.
- `FAQPage` JSON-LD only when a page has a real, visible FAQ.
- `HowTo`-style guides ("CCC photo size rejected — how to fix") linking to tools.
- Search Console + Bing Webmaster verification at launch.

## First production tool: `/ccc-photo-resizer`

Structure: breadcrumb → H1 → short intro (values from preset) → the tool (in the first mobile
screen) → how it works → CCC requirements table → source & verification → common problems →
FAQ (visible `<details>`, mirrored as `FAQPage` JSON-LD) → privacy note → related tools.
All requirement numbers in the copy are interpolated from the preset (`src/content/tool-content.ts`);
a unit test fails if they drift. No affiliation is claimed.

## Live CCC tools (P5)

`/ccc-photo-resizer`, `/ccc-signature-resizer`, `/ccc-thumb-impression-resizer` and
`/ccc-complete-pack` share the same page structure and tool components. Each has a unique
title/description/canonical, requirement values rendered from presets, the shared
"Source and verification" section, how-to, common problems, FAQ (+ `FAQPage` JSON-LD) and
related tools. Single-tool pages link to the Complete Pack; the pack links back through the
related-tools section. `/ccc-image-resizer` 301s (308) to `/ccc-complete-pack`.
Placeholder tools (`status: "coming-soon"`) are `noindex` and excluded from the sitemap.
