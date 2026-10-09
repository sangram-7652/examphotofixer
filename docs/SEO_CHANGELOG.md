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

## 2026-10-09 — `/ibps-complete-pack` — title/H1/description for search intent; pack FAQ depth

- Old title / New title (`/ibps-complete-pack`): "IBPS Complete Pack – Photo, Signature, Thumb &
  Declaration Images | ExamPhotoFixer" → "IBPS RRB Resizer – Photo, Signature, Thumb &
  Declaration for IBPS CRP RRBs-XV | ExamPhotoFixer". `metaTitle` in
  `src/lib/tools/registry.ts` (the `ibps-pack` entry) changed from `"IBPS Complete Pack – Photo,
Signature, Thumb & Declaration Images"` to `"IBPS RRB Resizer – Photo, Signature, Thumb &
Declaration for IBPS CRP RRBs-XV"`. Adds "RRB" and "Resizer" (the terms a competitor audit
  found missing from the rendered `<title>`) and keeps "IBPS" immediately next to "CRP
  RRBs-XV" — required by the existing guardrail test `"never names the CRP RRBs-XV cycle
without 'IBPS' immediately next to it"` (`src/lib/presets/presets.test.ts`), which exists so
  the scope can never read as ambiguous about which organisation's cycle it is. This mirrors the
  live `ibps-photo` title's own pattern ("IBPS Photo Resizer – Resize Photo for IBPS CRP
  RRBs-XV Forms"), which also names "IBPS" twice for the same reason. No bare year was added:
  the notification's year (2026) is already carried by "CRP RRBs-XV" and `source.published`; a
  literal "2026" in the title would go stale the moment IBPS issues a CRP RRBs-XVI notification,
  and the page would need a content update anyway at that point (new source, new SHA-256, new
  verification event) — so a year in the title buys no long-term value and risks looking
  outdated. The root layout's `"%s | ExamPhotoFixer"` template still applies here (this route is
  not `/`, so the homepage-only `title.absolute` exception doesn't apply) — confirmed by reading
  the actual built HTML (`.next/server/app/ibps-complete-pack.html`): `<title>IBPS RRB Resizer –
Photo, Signature, Thumb & Declaration for IBPS CRP RRBs-XV | ExamPhotoFixer</title>`.
- Old description / New description (`/ibps-complete-pack`): "Prepare all four IBPS CRP RRBs-XV
  application images — photo, signature, left thumb impression and handwritten declaration — on
  one page, check each against the requirements and download them as a ZIP. Processed in your
  browser." → "Resize and check all four IBPS CRP RRBs-XV application images — photo, signature,
  left thumb impression and handwritten declaration — against the official requirements, then
  download them together as a ZIP. Processed in your browser; nothing is uploaded." Adds the
  "resize" verb for intent match; keeps every existing claim (CRP RRBs-XV scope, all four
  documents named, ZIP, local processing) and strengthens the privacy claim ("nothing is
  uploaded" is more specific than "processed in your browser" alone).
- Other changes (H1, intro, links): H1 (`src/lib/tools/registry.ts`, `ibps-pack.h1`): "IBPS
  Complete Pack: Photo, Signature, Thumb Impression & Declaration" → "IBPS Complete Pack: Photo,
  Signature, Thumb Impression & Handwritten Declaration Resizer". Kept the literal "IBPS Complete
  Pack" prefix intact (both `e2e/smoke.spec.ts` and `e2e/ibps-documents.spec.ts` assert on that
  substring via `toContainText`, so no test changes were needed), renamed "Declaration" to
  "Handwritten Declaration" for consistency with the tool's own name, and added "Resizer". Did
  not add "(CRP RRBs-XV)" to the H1 itself — the scope is already explicit in the new title, the
  new description, and the existing `SourceVerification` `scopeNote` rendered on the page, so
  repeating it a third time in the H1 would be redundant without adding clarity.
  `ibps-pack.name` (`"IBPS Complete Pack"`) and `ibps-pack.summary` were left unchanged
  deliberately: `name` only drives internal UI chrome (breadcrumb label, the "Use the {pack.name}"
  cross-link sentence on the four individual tool pages, the `WebApplication` JSON-LD `name`
  field) — none of it is the rendered `<title>`, `<h1>` or meta description the audit actually
  measured, and changing it would force updating the exact-string `getByRole("link", { name:
"Use the IBPS Complete Pack" })` assertions in `e2e/ibps-documents.spec.ts` for zero SEO
  benefit. Flagging this choice in case the keyword should be added there too in a later pass.
  Pack FAQ (`ibpsPackContent` in `src/content/tool-content.ts`): added three FAQs reusing each
  document's existing verified `guidance` text from `src/lib/presets/ibps.ts` verbatim (no new
  requirement claims) — "How should I prepare the signature?" (surfaces the black-ink-pen
  guidance), "How should I prepare the left thumb impression?" (black-or-blue-ink and the
  missing-thumb alternative), "How should I prepare the handwritten declaration?" (English-only,
  no capitals, the typed-declaration alternative) — plus one new FAQ, "Does this pack replace the
  mandatory live photo capture?", promoting the pack's existing `commonProblems` "live photo and
  certificates" note into FAQ form (same claim, same wording style as the photo tool's own "Does
  this replace the live photo capture?" FAQ). The visible FAQ list and the `FAQPage` JSON-LD both
  read from the same `content.faq` array (`ToolPage.tsx`), so they stay structurally consistent
  with no separate sync step.
- Reason: competitor-gap reconciliation (2026-10-09) confirmed two real, narrow gaps against the
  actual rendered page (not competitor copying): the `<title>` lacked "RRB"/"resizer" entirely,
  and the pack's FAQ was thinner than the individual tool pages it summarizes (ink colour,
  thumb/declaration prep and the live-photo caveat were already written and verified elsewhere
  in the codebase but not surfaced on the pack page itself).
- Data source: competitor-gap reconciliation report (no ranking/analytics data; the site is not
  live). Audit could not verify Google India rankings, GSC indexation, or competitor CWV/UX —
  none of that evidence is claimed here.
- Expected behaviour: the pack page's title and FAQ now match the terms a user searching for
  "IBPS RRB photo signature thumb declaration resizer" would actually use, without implying
  coverage of any IBPS recruitment beyond CRP RRBs-XV; no ranking/CTR expectation is set
  pre-launch.
- Review date: 4 weeks after launch (Search Console, once indexed).
- Review: pending.
