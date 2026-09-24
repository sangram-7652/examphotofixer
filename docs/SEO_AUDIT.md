# SEO Audit (P7)

State after P7. No ranking or traffic numbers are included; the site has not launched.

## Indexable routes (when `NEXT_PUBLIC_SITE_INDEXABLE=true`)

`/`, `/tools`, `/guides`, `/privacy`, `/terms`, `/ccc-photo-resizer`, `/ccc-signature-resizer`,
`/ccc-thumb-impression-resizer`, `/ccc-complete-pack`, `/image-resizer`, `/image-compressor`,
`/guides/ccc-photo-size`, `/guides/ccc-signature-size`, `/guides/ccc-thumb-impression-size`,
`/guides/ccc-photo-upload-problems`.

Until launch the whole site is `noindex, nofollow` and robots.txt disallows `/` (site-wide switch).

## Noindex routes

- Registry tools with `status: "coming-soon"` (none today; mechanism tested).
- `/dev/image-engine` (test harness; 404 unless `ENGINE_HARNESS=1`, always noindex).
- 404 pages (real 404 status; unknown guide slugs 404 via `dynamicParams = false`).

SSC, Railway and UPSC have **no pages**; they appear only as "Coming Soon" text on `/tools` and in
the homepage exam search.

## Sitemap

Generated from `listSiteRoutes()` (`src/lib/seo/routes.ts`): static pages, live tools and
published guides. Excludes placeholders, redirects, `/dev/*`, duplicates. URLs use
`NEXT_PUBLIC_SITE_URL` via `absoluteUrl()` — the same host as canonicals. The e2e SEO spec
asserts the exact URL list and that each returns 200.

## Canonicals

`buildPageMetadata({ path })` → `alternates.canonical = path` resolved against `metadataBase`
(`NEXT_PUBLIC_SITE_URL`). Every indexable page has exactly one self-referencing canonical with
no query string (asserted on raw HTML). No trailing slashes: `/x/` → 308 → `/x`. Redirect
sources are never canonical targets.

## Robots

Live: `Allow: /`, `Disallow: /dev/`, `Sitemap: <site>/sitemap.xml`. Pre-launch: `Disallow: /`.
CSS/JS are never blocked.

## Structured data

One JSON-LD block per page, built by `src/lib/seo/json-ld.ts`:

| Page                | Types                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Home                | WebSite                                                            |
| Tools               | WebApplication (free Offer), BreadcrumbList, FAQPage (visible FAQ) |
| `/tools`, `/guides` | BreadcrumbList                                                     |
| Guides              | BreadcrumbList, FAQPage (visible FAQ)                              |

No Review, Rating, AggregateRating or Organization/government claims. FAQ schema is built from
the same list as the visible `<details>` FAQ; e2e compares questions and answers on raw HTML.
BreadcrumbList only where visible breadcrumbs exist.

## Internal linking

Home → tools (cards) and header → Tools / Guides. Tool pages → related tools, the Complete Pack
callout (CCC), contextual CCC/generic callouts, and **Related guides**. Guides → tools via
descriptive buttons and inline links, and → other guides. The e2e crawl verifies every internal
link on sitemap pages returns 200 without redirects.

## Content cluster (CCC)

| Page                                                                            | Intent                      |
| ------------------------------------------------------------------------------- | --------------------------- |
| `/ccc-photo-resizer`, `/ccc-signature-resizer`, `/ccc-thumb-impression-resizer` | Do the task                 |
| `/ccc-complete-pack`                                                            | Do all three together       |
| `/guides/ccc-photo-size`, `-signature-size`, `-thumb-impression-size`           | "What size/KB/DPI?"         |
| `/guides/ccc-photo-upload-problems`                                             | "Why is my upload failing?" |

Variants such as "132x170", "5 to 50 KB" or "CCC photo DPI" are answered on the size guide and
tool pages rather than separate pages.

## Source verification

All CCC values come from presets citing NIELIT CCC Examination Application Guidelines,
Version 1.11 (2023), page 3, verified 2026-09-24 (SHA-256 recorded). Guides and tools render
values through `describePreset()` and the shared `SourceVerification` component; unit tests
prove a preset change flows into guide text. No affiliation or acceptance-guarantee claims.

## Search Console

See `SEO_SEARCH_CONSOLE.md`. Verification via DNS (preferred) or `GOOGLE_SITE_VERIFICATION`
env var; nothing secret in git.

## Known limitations

- Pre-launch: the site is intentionally noindex until tools are signed off.
- No per-page Open Graph images yet (text-only OG/Twitter cards).
- `/privacy` and `/terms` are drafts pending legal review (indexable, low priority).
- Guides have no `Article` schema (kept to types that match visible content without extra claims).
- `generateStaticParams` + `dynamicParams = false` logs a harmless `NoFallbackError` in the server
  log for unknown guide slugs; the response is a real 404.

## Future opportunities

- Per-page OG images; Hindi-language versions of the CCC guides if search data shows demand.
- More guides only where Search Console shows distinct unanswered intents.
- New exam tools and guides only after their requirements are verified from official sources.
