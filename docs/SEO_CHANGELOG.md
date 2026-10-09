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

## 2026-10-09 — IBPS scope wording, content consistency and trust fixes (SEO audit)

- Old title / New title (`/`): "ExamPhotoFixer – Exam Photo & Signature Resizer" → "Exam Photo &
  Signature Resizer for CCC and IBPS RRB | ExamPhotoFixer". The full string, including the
  "| ExamPhotoFixer" suffix, is now written explicitly in `src/app/page.tsx` and set with
  `title: { absolute: homeTitle } }` and passed to Open Graph/Twitter directly — **not** left
  for the root layout's `%s | ExamPhotoFixer` template to add. (An earlier version of this
  entry said the template added the suffix; it doesn't. Per Next's own docs
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`),
  a layout's `title.template` never applies to a title set by `page.js` of that _same_ route
  segment, and `/` is exactly that segment — so the earlier removal of the explicit `absolute`
  title silently dropped the site name from `<title>` and `og:title` until this fix put it
  back, written out in full rather than relying on the template.)
- Old description / New description (`/`): was the generic `siteConfig.description`; now a
  homepage-specific description naming CCC, "IBPS RRB (CRP RRBs-XV)", browser-local processing
  and no server upload/storage.
- Other changes (H1, intro, links):
  - IBPS tool `summary` fields and several `metaDescription`s (registry.ts) replaced generic
    "IBPS bank recruitment application forms" / "IBPS application forms" / "IBPS forms" with
    "the IBPS CRP RRBs-XV application" / "the IBPS CRP RRBs-XV scanning guidelines", so no copy
    implies coverage of IBPS recruitments beyond the one verified notification.
  - `/guides/ibps-photo-size` title/description/summary and the combined
    signature/thumb/declaration guide's description/summary: same generic-"IBPS" → "IBPS CRP
    RRBs-XV" fix.
  - `/tools` meta description: "IBPS" → "IBPS CRP RRBs-XV" for the resizer list.
  - ToolPage eyebrow: IBPS tool pages showed "IBPS · IBPS" (conducting body duplicating the
    short name, called out but left as-is in the 2026-09-25 P12.1 entry above). A first pass
    swapped the short name for the exam's `scopeLabel`, which only removed the duplication when
    the two strings were exactly equal — it still rendered "IBPS CRP RRBs-XV · IBPS" (the review
    below caught this). `examByline()` (`src/lib/presets/exams.ts`) now does a case-insensitive
    substring check instead of an exact-equality check, so the conducting body is dropped
    whenever it's already named inside the scope label; IBPS tool pages now show plainly "IBPS
    CRP RRBs-XV", while CCC is unaffected ("CCC · NIELIT", since "NIELIT" isn't contained in
    "CCC"). The "{exam} upload requirements" H2 is unchanged by this fix (it only ever showed
    the scope label, never the conducting body, so it had no duplication): "IBPS CRP RRBs-XV
    upload requirements" instead of "IBPS upload requirements".
  - Spelling consistency: "Hand-written declaration" / "hand-written declaration" → "Handwritten
    declaration" / "handwritten declaration" everywhere user-facing (preset label, registry
    name/h1/metaDescription/summary, tool-content.ts, guides.ts, preset-labels.ts). Internal,
    non-rendered fields (`RequirementSource.notes`, code comments, the monitoring-report
    generator) were left as-is — not user-facing content.
  - CCC signature and thumb impression guide/tool content: the two pages' "can't fix…" and
    common-problem copy was near-identical; each now names its own failure modes (faint/bled
    ink and re-signing for the signature; smudged/partial/faint impression and re-inking for the
    thumb) instead of a shared one-line caveat. No new requirement claims — only tool-limitation
    and preparation copy, not sourced guideline text.
  - `/` gains a new "Guides: size, KB, DPI and upload problems" section linking directly to the
    six guides most likely to answer a size/KB/DPI or upload-problem query (previously reachable
    only via `/guides`, the footer, or a related-guides list on another guide/tool page).
  - `/privacy`: the GA4 paragraph now names the actual mechanism (`client_storage: "none"`) it
    already uses, and a new "How requirement values are checked" paragraph explains the
    verification practice already in place (source documents, version, checked date, link).
    No new legal claims; no change to what data is actually collected.
- Reason: SEO/content/trust audit (2026-10-09) found generic "IBPS" wording that overstated
  scope beyond the one verified notification (CRP RRBs-XV), inconsistent "hand-written"
  spelling, near-duplicate CCC signature/thumb copy, a literal "IBPS · IBPS" label, no homepage
  links to the guides, and Privacy Policy wording that was accurate but less specific than the
  implementation. The audit's claim that four guides showed "Last reviewed 24 September 2026"
  was checked against the live code and found already correct — both sources' `verifiedOn` is
  `2026-09-25`, and `GuidePage` renders that field directly — so no change was needed there (see
  "Audit items not changed" below).
- Data source: content audit (no data); the site is not live.
- Expected behaviour: homepage and tool-page copy no longer reads as covering more of IBPS than
  is verified; no ranking/CTR expectation is set pre-launch.
- Review date: 4 weeks after launch (Search Console, once indexed).
- Review: pending.

Audit items checked but intentionally not changed (already correct, or out of the audit's
scope for this product):

- Guide "Last reviewed" date: already `25 September 2026` on every CCC/IBPS guide (derived live
  from `source.verifiedOn`, not a hard-coded date) — the audit's "24 September" finding did not
  reproduce in the current code.
- CCC source citation and PDF/printed page (`page: 3`) and the CCC physical-size values (3.5×4.5
  cm / 4.5×3.5 cm): already shown via `sourceCitation()` and `RequirementsTable` on every CCC
  tool and guide page — no missing citation or dimension found.
- No Article JSON-LD exists (or was added): guides use Open Graph `article` `publishedTime`/
  `modifiedTime` only, already consistent with `source.verifiedOn`/`firstVerifiedOn`; adding a
  separate `Article` type would be new schema beyond what the audit asked to fix.
- No About page exists and none was added, per the task's instruction not to create a large new
  page; the trust content it asked for (source, version, checked date shown; unverified exams
  never presented as verified) already exists via `SourceVerification` and the Privacy Policy.
- No "effective/last updated" date was added to `/privacy` or `/terms`: neither page has an
  existing date convention to extend, and inventing one would be a fabricated date.

