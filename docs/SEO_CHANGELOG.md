# SEO changelog

Every meaningful change to a title, meta description, H1, intro copy, internal links or
indexable pages is recorded here **before** it ships, with the reason and the data behind it.
An entry never says a change "worked" without follow-up data from the named source; results
go in the entry's "Review" line on or after its review date. Experiments with a metric live
in `EXPERIMENTS.md` and are linked from here.

Template:

```
## YYYY-MM-DD — <page(s)> — <short change>
- Old title / New title:
- Old description / New description:
- Other changes (H1, intro, links):
- Reason:
- Data source: <Search Console export + date range | analytics export | content audit (no data)>
- Expected behaviour:
- Review date:
- Review: <pending | observed values with date range and source>
```

## 2026-09-25 — site-wide description (home meta description, home subheading, WebSite JSON-LD, layout default)

- Old title / New title: unchanged (`ExamPhotoFixer – Exam Photo & Signature Resizer`).
- Old description: "Resize, compress, crop and validate photos, signatures and documents for
  online applications."
- New description: "Resize, compress, crop and validate photos, signatures and thumb
  impressions for online exam and application forms."
- Other changes: none.
- Reason: accuracy. The site has no document (PDF) tools; the old text promised them. The new
  text names only what the tools do.
- Data source: content audit (no data). The site is not live; no Search Console data exists.
- Expected behaviour: search snippets describe the site accurately. No CTR expectation is set.
- Review date: 4 weeks after launch, with Search Console data for `/`.
- Review: pending.

## 2026-09-25 — `/` — list tools for every exam with live tools

- Old title / New title: unchanged. Old description / New description: see the entry above.
- Other changes: the homepage had one hard-coded "CCC tools" section, so the live, verified
  IBPS Photo Resizer was reachable only through the exam search or `/tools`. The homepage now
  renders one "{Exam} tools" section per exam with live tools, from the registry (adds an
  "IBPS tools" section with one internal link). e2e guards it for every future exam.
- Reason: internal linking and landing-page clarity; a verified tool was missing from the
  primary landing page.
- Data source: content audit (no data).
- Expected behaviour: IBPS tool reachable in one click from `/`; crawlers find it from the home.
- Review date: 4 weeks after launch (Search Console: `/ibps-photo-resizer` indexed and
  discovered via internal links).
- Review: pending.

## 2026-09-25 — new IBPS pages (P12)

- New indexable pages: `/ibps-signature-resizer`, `/ibps-thumb-impression-resizer`,
  `/ibps-handwritten-declaration-resizer`, `/ibps-complete-pack`,
  `/guides/ibps-signature-thumb-declaration-size` (sitemap 17 → 22 URLs). Titles and
  descriptions: see `src/lib/tools/registry.ts` and `src/content/guides.ts`.
- Other changes: `/guides/ibps-photo-size` gains a link to the IBPS Complete Pack; IBPS tool
  pages link the pack with the full list of its four documents (previously a fixed CCC list).
- Reason: the verified IBPS notification requires all four images to register; only the photo
  was supported. Each page answers one distinct need; no keyword or programmatic pages.
- Data source: official source verification (no search data exists).
- Expected behaviour: pages indexed after launch; no traffic expectation is set.
- Review date: 4 weeks after launch (Search Console: indexing of the five URLs).
- Review: pending.

## 2026-09-25 — `/guides` title and description (P12)

- Old title: "Guides – CCC Photo, Signature & Thumb Requirements and Upload Help"
- New title: "Guides – CCC & IBPS Photo, Signature and Document Requirements"
- Old description: "Short guides to the CCC photo, signature and left thumb impression
  requirements, with sources, and fixes for common photo upload problems."
- New description: "Short guides to the CCC and IBPS photo, signature, thumb impression and
  declaration requirements, with their official sources, and fixes for common photo upload
  problems."
- Reason: accuracy. IBPS guides existed since P8 but the index described only CCC.
- Data source: content audit (no data).
- Expected behaviour: accurate snippet. Review date: 4 weeks after launch. Review: pending.

## 2026-09-25 — UI polish (P12.1): visible copy only

- Titles, meta descriptions, H1s, canonicals, structured data and URLs: **unchanged**.
- `/` supporting line under the H1: was the site description; now "Resize, compress and prepare
  application images to match verified requirements — directly in your browser." New sections:
  four-step workflow, privacy band, exam cards with requirement values from presets.
- Tool pages: an eyebrow above the H1 ("CCC · NIELIT", "IBPS · IBPS", "Image tool").
- Guides: requirement section heading was the hard-coded "Requirements stated in the referenced
  NIELIT guideline" on every guide (wrong on IBPS guides); now names the guide's own source
  authority.
- Result heading for below-minimum results: "Ready — with a warning" → "Review before
  downloading".
- Reason: product UI polish and one accuracy fix. Data source: design review (no data).
- Review date: 4 weeks after launch. Review: pending.
