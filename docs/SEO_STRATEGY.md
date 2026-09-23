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
Home ──▶ exam hubs (/ccc-image-resizer) ──▶ individual tools
  │                         ▲                        │
  └──▶ /tools (all) ────────┘◀── related tools ◀──────┘
Guides (future) ──▶ tools they explain
```

## Next

- OG images per tool (`opengraph-image.tsx`) once branding is final.
- `FAQPage` JSON-LD only when a page has a real, visible FAQ.
- `HowTo`-style guides ("CCC photo size rejected — how to fix") linking to tools.
- Search Console + Bing Webmaster verification at launch.
