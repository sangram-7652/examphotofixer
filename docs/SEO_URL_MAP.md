# SEO URL Map

| Path                            | Page                                   | Primary intent                                           | Sitemap             | Indexable* |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------- | ------------------- | ---------- |
| `/`                             | Home                                   | exam photo resizer, brand                                | ✅                  | ✅         |
| `/ccc-photo-resizer`            | CCC Photo Resizer                      | ccc photo resize / size                                  | ✅                  | ✅         |
| `/ccc-signature-resizer`        | CCC Signature Resizer                  | ccc signature resize                                     | ✅                  | ✅         |
| `/ccc-thumb-impression-resizer` | CCC Left Thumb Impression Resizer      | ccc thumb impression size                                | ✅                  | ✅         |
| `/ccc-complete-pack`            | CCC Complete Pack (hub)                | ccc photo signature thumb resize, ccc application images | ✅                  | ✅         |
| `/image-resizer`                | Generic Image Resizer (placeholder)    | resize image to pixels                                   | ❌ until live       | ❌ noindex |
| `/image-compressor`             | Generic Image Compressor (placeholder) | compress image to KB                                     | ❌ until live       | ❌ noindex |
| `/tools`                        | All tools                              | —                                                        | ✅                  | ✅         |
| `/guides`                       | Guides index                           | —                                                        | ❌ (no content yet) | ❌ noindex |
| `/privacy`                      | Privacy policy                         | —                                                        | ✅                  | ✅         |
| `/terms`                        | Terms of use                           | —                                                        | ✅                  | ✅         |

\* Only after `NEXT_PUBLIC_SITE_INDEXABLE=true`. Until then the whole site is noindex.

## Redirects

| From                 | To                   | Type                              |
| -------------------- | -------------------- | --------------------------------- |
| `/ccc-image-resizer` | `/ccc-complete-pack` | permanent (308), `next.config.ts` |

## Conventions

- Lowercase, hyphenated, no trailing slash, no query-string variants.
- Pattern: `/<exam>-<document>-resizer` for exam tools; `/<exam>-image-resizer` for exam hubs.
- Guides (future): `/guides/<slug>`.
- A URL, once published, is never changed without a 301 redirect in `next.config.ts`.
- Source of truth: `TOOLS` in `src/lib/tools/registry.ts` + `STATIC_ROUTES` in `src/lib/seo/routes.ts`.
