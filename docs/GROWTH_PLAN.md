# Growth plan (P11)

Written 2026-09-25. Every statement is labelled:

- **FACT**: true today and checkable in this repository or by a request anyone can repeat.
- **HYPOTHESIS**: a belief to test. Not evidence.
- **FUTURE EXPERIMENT**: a planned change with a metric, run only when its data source exists
  (`EXPERIMENTS.md`).

No traffic, ranking, CTR, conversion, user or revenue figure appears here, because none exists.

## 1. Current production state

- **FACT:** the site is not live. On 2026-09-25 `examphotofixer.com` did not resolve in DNS
  (`curl` → no response; `getent hosts` → nothing), while other sites were reachable.
- **FACT:** the code is launch-ready (P10, commit `ec1ebfd`): security headers, launch smoke
  check, robots/sitemap gates. Remaining launch blockers are in `PRODUCTION_LAUNCH_CHECKLIST.md`
  (legal review, contact address, hosting, domain, DNS, production environment).
- **FACT:** live tools: CCC photo, signature, left thumb, CCC Complete Pack, IBPS photo, Image
  Resizer, Image Compressor. Guides: 5 (`/guides`). Active exams: CCC, IBPS. Planned (no
  presets): SSC, Railway, UPSC.

## 2. Available data

| Source                           | Status            | Notes                                                   |
| -------------------------------- | ----------------- | ------------------------------------------------------- |
| Google Search Console            | **NOT AVAILABLE** | No property: the domain isn't live or verified.         |
| On-site analytics                | **NOT AVAILABLE** | No provider installed (P9); events stay in the browser. |
| Production traffic               | **NOT AVAILABLE** | Not deployed.                                           |
| Conversion data                  | **NOT AVAILABLE** | Needs a provider and traffic.                           |
| `fixtures/search-console/FAKE-…` | **TEST FIXTURE**  | Invented; tools label it `DATA CLASS: TEST_FIXTURE`.    |
| `fixtures/analytics/FAKE-…`      | **TEST FIXTURE**  | Invented; same label.                                   |

The tools classify every input: `REAL` (an export the owner supplied) or `TEST_FIXTURE` (files
carrying the `# FAKE DATA` header). "NOT AVAILABLE" means no file exists.

## 3. Search demand

- **FACT:** no search-demand data exists for this site.
- **HYPOTHESIS:** candidates search with exam + document + requirement words ("ccc photo size"),
  exact specs ("… {n} kb", "{width}x{height}"), or an upload error. This hypothesis only shaped the
  classifier's rules; it is not evidence of volume.

How demand will be read once Search Console exists (all local, nothing uploaded):

```
npm run search:report -- Queries.csv                      # UI export (one dimension)
npm run search:report -- rows.csv --previous last-month.csv --events events.ndjson
```

The report prints: top queries/pages by impressions and clicks, query → page, low-CTR queries,
device, country, date trend, intent mix, **opportunities**, **new queries** since the previous
export, and **pages with clicks but weak engagement** (joined with an event export).
Details: `SEARCH_DATA_ANALYSIS.md`.

## 4. Search intent categories

Deterministic rules in `src/lib/search-data/intent.ts` (unit-tested; the rule that fired is
reported with each label). Exam names come from the exam registry.

| Intent                | Rule (first match wins)                                                                 | Example                             |
| --------------------- | --------------------------------------------------------------------------------------- | ----------------------------------- |
| `NAVIGATIONAL`        | brand name                                                                              | "examphotofixer"                    |
| `PROBLEM_INTENT`      | failure words (too large, rejected, not uploading)                                      | "photo too large for upload"        |
| `EXACT_TOOL_INTENT`   | exam + tool word or a size/dimension                                                    | "ibps photo {n} kb"                 |
| `REQUIREMENT_INTENT`  | exam + requirement word or document; or document + requirement word for an unknown exam | "ccc photo size", "neet photo size" |
| `GENERIC_TOOL_INTENT` | tool word or size + image word, no exam                                                 | "compress jpg to {n}kb"             |
| `INFORMATIONAL`       | anything else                                                                           | "what is dpi"                       |

## 5. Existing page opportunities

The opportunity engine (`src/lib/search-data/opportunities.ts`) proposes, never publishes.
Each proposal carries query, intent, impressions, clicks, CTR, position, top page, existing
tool/guide, type, reason and evidence (source file + data class).

| Type                          | Rule                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `NO_ACTION`                   | Below the evidence threshold (default < 100 impressions), brand queries, or no rule fires.                                |
| `CREATE_TOOL` (verify)        | Demand for a planned/unknown exam, or an active exam's document without a verified preset. Always `verificationRequired`. |
| `UPDATE_REQUIREMENT` (verify) | Query numbers differ from the verified preset → **re-check the official source**; never change a preset from search data. |
| `CREATE_GUIDE`                | Problem queries for an exam that has no upload-problems guide.                                                            |
| `ADD_INTERNAL_LINK`           | Tool-intent query whose top page is a guide.                                                                              |
| `OPTIMIZE_EXISTING_PAGE`      | Position ≤ 10 and CTR below the threshold (default 2%).                                                                   |

- **FACT:** on the fake fixture, the engine proposes nothing (all below threshold) — tested.
- **FACT:** content audit (not data) on 2026-09-25 found and fixed two landing-page issues:
  the homepage listed CCC tools but not the live IBPS tool, and the site description promised
  "documents" tools that don't exist. Both are in `SEO_CHANGELOG.md`.

## 6. Tool conversion opportunities

The main conversion is **a user gets a valid, downloadable result**. Funnel (P9):
`tool_viewed → image_selected (accepted) → processing_started → processing_completed →
result_ready | result_ready_with_warning → download_started → download_completed`.

`npm run analytics:report -- events.ndjson` computes per-tool funnels with READY and
READY_WITH_WARNING kept apart, and withholds any rate whose denominator is below
`--min-sample` (default 100). Rates count events, not people.

- **HYPOTHESIS:** most drop-off will be between `tool_viewed` and `image_selected` on mobile.
  Only a real export can confirm or reject it.
- Rules: no dark patterns, no fake urgency or scarcity, no forced sign-up, requirements never
  hidden, download never obstructed; READY_WITH_WARNING stays downloadable with its warning.

## 7. Content opportunities

- **FACT:** no new page is justified by data today; none was created in P11.
- **Problem discovery** (from `analytics:report`): reason codes such as `FILE_TOO_SMALL`,
  `COMPRESSION_LIMIT_NOT_REACHED` or rejected `unsupported-format` files, each flagged "observe,
  don't act" until it reaches the minimum sample. Only repeated evidence justifies clearer
  guidance; the engine is never changed because of a single event.
- **Candidate resources (HYPOTHESIS, not built):** a "before you upload" checklist per exam
  generated from verified presets; a requirement comparison table across verified exams. Each
  must link to the official source, never copy the notification, and be built only if
  Search Console shows matching demand or partners ask for it.

## 8. Exam opportunities

Search demand ≠ verified requirement. A candidate becomes a preset only through
`EXAM_REQUIREMENT_VERIFICATION.md` (official source, TLS, SHA-256, page, corrigenda,
verbatim mapping). No placeholder tools. See section 16 for the P12 list.

## 9. Distribution channels

Order by expected fit (HYPOTHESIS), each leading to an existing useful page:

1. **Organic search** — the site's structure (tools + requirement guides) is built for it.
   Measured with Search Console once live.
2. **Answers where the question is asked** — reply to a specific upload problem in a
   community thread with the fix and one relevant link, disclosed as our own tool. Manual,
   one at a time, only when it answers the question asked.
3. **Educational short videos/posts** — "how to make your CCC photo match the requirement"
   (templates below).
4. **Student and exam-preparation communities** (Telegram/WhatsApp groups, subreddits,
   forums) — only where the rules allow tool links; ask moderators first.
5. **Developer/product communities** — a "browser-only image processing" write-up is a
   legitimate technical story (privacy, workers, byte-exact compression).
6. **Resource pages and partners** — section 11.

Never: spam, automated or mass posting, fake accounts, fake reviews, link farms, bought
links, misleading outreach, copied content, government-affiliation claims.

## 10. Social content templates

Fill `{…}` from the verified guide or tool page at posting time (values come from presets, with
their source and version); never type requirement numbers from memory. Every post links to the
matching tool or guide and never claims official status, guaranteed acceptance or usage numbers.

- **Problem → solution (Hinglish):** "{Exam} form mein photo upload nahi ho rahi? Size
  {kb range} aur {dimensions} hona chahiye. Upload se pehle yahan exact size mein banayein —
  photo aapke phone se bahar nahi jaati: {tool link}. Official notification zaroor check karein."
- **Requirement (English):** "{Exam} {document} requirements ({source}, {version}): {dimensions},
  {kb range}, {format}{, dpi}. Check yours before you upload: {guide link}."
- **Workflow:** "Photo → crop → resize → check → download. Every step runs in your browser.
  {tool link}"
- **Mistake explainer:** "Why {Exam} rejects photos: {one verified reason from the guide}. How
  to fix it: {guide link}."

Social links are added to the site only for accounts that exist.

## 11. Link and partnership opportunities

Who (HYPOTHESIS): education blogs, student-resource sites, application-help pages, coaching
resources, digital-service centres, community resource lists.

Outreach template (sent manually, one recipient at a time, never automated):

> Subject: A free tool for the {Exam} photo/signature step
>
> Hi {name}, I read your page on {topic}. I built ExamPhotoFixer, a free tool that resizes
> and checks {Exam} photos and signatures against the published requirements ({source},
> {version}) — files are processed in the browser and never uploaded. If it's useful for your
> readers: {link}. It isn't affiliated with {authority}, and it links to the official
> notification. Happy to fix anything you spot. — {sender}

## 12. Monetization hypotheses

Not implemented; none before product-market evidence (sustained real usage and completion).

| Model                     | Condition to consider             | Risks / notes                                                                                                                                                                         |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ads                       | Meaningful traffic                | Third-party scripts break the CSP (`connect-src 'self'`) and privacy promise; slower pages. Would need a privacy and performance review, consent where required. Never on tool steps. |
| Premium convenience       | Repeated requests for extras      | Basic verified functionality stays free.                                                                                                                                              |
| Bulk processing           | B2B signals (section 13)          | Must stay browser-local.                                                                                                                                                              |
| B2B / service-centre plan | Verified demand from centres      | Invoicing, support.                                                                                                                                                                   |
| Paid document packs       | Evidence users want curated packs | Must not paywall requirements.                                                                                                                                                        |
| API                       | Only if clearly justified         | Would mean server-side processing: out of scope for V1.                                                                                                                               |

No intrusive popups, forced sign-up, paywall on basic tools or misleading ads.

## 13. B2B and bulk demand hypotheses

HYPOTHESES only; nothing is built:

- Cyber cafés and CSC-style service centres prepare many applicants' images in a day.
- Coaching institutes help batches of students apply for the same exam.
- Signals to look for: repeated sessions processing many images per tool view (event counts
  per route), direct requests, guide traffic from centre-related queries. There are no user
  identifiers, so "same user" can't be measured; ask directly instead.

## 14. KPIs

Only measurable once data exists; no targets are set before a baseline.

| KPI                                                | Source                          |
| -------------------------------------------------- | ------------------------------- |
| Impressions, clicks, CTR, position by page         | Search Console                  |
| Indexed pages vs sitemap                           | Search Console                  |
| `ready_rate`, `warning_rate` (separate)            | `analytics:report`              |
| `successful_download_rate` (READY)                 | `analytics:report`              |
| Tool select rate (accepted files per view)         | `analytics:report`              |
| Guide → tool clicks per guide view                 | `analytics:report` / engagement |
| Lab performance and accessibility (no regressions) | `DEPLOYMENT.md` audit method    |

## 15. Review cadence

- After launch: weekly Search Console check for 4 weeks (indexing, errors), then monthly
  `search:report` with `--previous` for new queries.
- Monthly `analytics:report` once a provider exists; act only on rates above the minimum sample.
- Each experiment on its own review date (`EXPERIMENTS.md`); each SEO change in
  `SEO_CHANGELOG.md` with its review date.
- Quarterly: re-verify every preset's official source for new notifications.

## 16. P12 inputs (handoff)

None of these is backed by search data (none exists). They are listed with what is and isn't
known, so P12 inherits no assumption as fact.

| Candidate                                            | Demand source | Official source availability                                                                                                      | User problem                                      | Existing page/tool        | Proposed action                                                       | Verification status                  |
| ---------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| IBPS signature, left thumb, hand-written declaration | NOT AVAILABLE | Same IBPS notification already used for the photo; values recorded in `EXAM_REQUIREMENT_VERIFICATION.md` (P8) but not implemented | Completing the IBPS application's other uploads   | IBPS photo tool + guide   | Re-verify against the current notification, then presets, tools, pack | Recorded, not implemented; re-verify |
| SSC                                                  | NOT AVAILABLE | Not checked                                                                                                                       | Photo/signature for SSC applications (HYPOTHESIS) | Exam search entry only    | Find the current official notice; verify per process                  | Not verified — no preset             |
| Railway (RRB)                                        | NOT AVAILABLE | Not checked                                                                                                                       | Same (HYPOTHESIS)                                 | Exam search entry only    | Same                                                                  | Not verified — no preset             |
| UPSC                                                 | NOT AVAILABLE | Not checked                                                                                                                       | Same (HYPOTHESIS)                                 | Exam search entry only    | Same                                                                  | Not verified — no preset             |
| IBPS upload-problems guide                           | NOT AVAILABLE | IBPS notification (verified)                                                                                                      | Upload errors (HYPOTHESIS)                        | CCC has one; IBPS doesn't | Write only if problem queries appear (`CREATE_GUIDE` rule)            | Source verified; demand unknown      |
| Launch itself                                        | —             | —                                                                                                                                 | No data can exist until the site is live          | —                         | Complete `PRODUCTION_LAUNCH_CHECKLIST.md`; it gates every item above  | —                                    |
