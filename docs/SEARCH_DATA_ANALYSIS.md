# Search data analysis

Status (P9): **tooling only; no real Search Console data has been analysed.** The site's
Search Console property data was not available during P9. The only data in the repository is
`fixtures/search-console/FAKE-search-console-sample.csv`, which is invented (queries prefixed
`fake`, pages on `example.invalid`, dates in 2000) and must never be quoted as traffic.

Setting up the property, sitemap and URL inspection: `SEO_SEARCH_CONSOLE.md`.

## What Search Console provides

Performance → Search results, per property:

| Dimension         | Values                         | Notes                                                          |
| ----------------- | ------------------------------ | -------------------------------------------------------------- |
| Query             | The search text                | Anonymised queries are omitted, so query totals < page totals. |
| Page              | Canonical URL shown in results |                                                                |
| Country           | ISO 3166 alpha-3 (`ind`)       |                                                                |
| Device            | `DESKTOP`, `MOBILE`, `TABLET`  |                                                                |
| Date              | Day (Pacific time)             | Data lags ~2 days; UI keeps 16 months.                         |
| Search appearance | Rich result types              | Not used by the script.                                        |

Metrics: **clicks**, **impressions**, **CTR** (clicks ÷ impressions) and **average position**
(impression-weighted, 1 = top). Positions are averages, not ranks.

Exports:

- **UI export** (Performance → Export → CSV/Google Sheets): one CSV per tab — `Queries.csv`
  ("Top queries"), `Pages.csv` ("Top pages"), `Countries.csv`, `Devices.csv`, `Dates.csv` —
  each with one dimension plus Clicks, Impressions, CTR, Position. Max 1,000 rows per tab.
  Query + page combinations are **not** in the UI export.
- **Row-level** (Search Console API `searchanalytics.query`, Looker Studio, or BigQuery bulk
  export): several dimension columns per row, e.g. query, page, country, device, date. Needed
  for query/page combinations.

## Local analysis script

```
npm run search:report -- <export.csv> [more.csv ...] [--limit 20] [--min-impressions 100] [--max-ctr 0.02]
npm run search:report -- fixtures/search-console/FAKE-search-console-sample.csv   # demo, fake data
```

- Reads CSVs you downloaded; sends nothing, writes nothing, no services, no database.
- Headers are matched case-insensitively (`Top queries`/`Query`, `Top pages`/`Page`/`URL`,
  `Country`, `Device`, `Date`, `Clicks`, `Impressions`, `CTR`, `Position`). Commas in numbers
  and `%` are handled; lines starting with `#` are comments.
- CTR and position are **recomputed** from clicks, impressions and position (weighted by
  impressions), not averaged from the CTR column.
- Sections an export can't answer are printed as "not available" instead of being guessed
  (e.g. query + page from a UI `Queries.csv`).
- Logic: `src/lib/search-data/gsc.ts` (pure, unit-tested in `gsc.test.ts`); CLI:
  `scripts/search-console-report.ts` (runs with Node 24 type stripping, no build step).

Report sections:

| Section                           | Definition                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Top queries by impressions/clicks | Sum per query, sorted descending, `--limit` rows                               |
| High-impression, low-CTR queries  | `impressions ≥ --min-impressions` and `CTR < --max-ctr`, sorted by impressions |
| Top pages by impressions/clicks   | Sum per page                                                                   |
| Query + page combinations         | Sum per (query, page), sorted by impressions (row-level exports only)          |
| Devices / Countries / Dates       | Sum per dimension; dates chronological                                         |

The thresholds are explicit inputs, not facts about the site: choose them from the site's own
distribution (e.g. median CTR at a similar position) once real data exists.

## Derived analyses (how to read the report)

1. **Demand by exam and asset.** Group top queries by exam (`ccc`, `ibps`) and asset (photo,
   signature, thumb). Only use this to prioritise work on _verified_ exams; never create pages
   for keywords (no programmatic or keyword pages).
2. **Low CTR at good positions.** Queries with position ≤ 10 and low CTR suggest the title or
   description doesn't answer the query. Improve clarity; don't add keywords.
3. **Query → landing page fit.** From query + page rows: does the query land on the page that
   answers it (tool vs guide)? A size query landing on a tool may be fine; an error-message
   query should land on the upload-problems guide.
4. **Cannibalisation.** One query with impressions spread across several pages at similar
   positions.
5. **Device split.** Compare mobile vs desktop CTR/position; most users are expected on mobile.
6. **Trend.** Daily clicks/impressions around deploys (only with enough data; small numbers
   are noise).

## Diagnostic signals (what to investigate, not conclusions)

Hypotheses to check once real data exists. None of these is currently observed: no real
Search Console or analytics data has been analysed.

| Signal (source)                                                         | Investigate                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| High impressions, low CTR (Search Console)                              | Title/description vs the query's intent; is the right page ranking?          |
| High clicks, low `tool_viewed` or `guide_tool_clicked` (GSC + events)   | Landing-page relevance and the tool call to action.                          |
| High `tool_viewed`, low `image_selected` (events)                       | Requirement clarity above the fold; upload UX on mobile.                     |
| High `processing_started`, low `download_completed` (events)            | `validation_failed` reason codes, result presentation, requirement mismatch. |
| High `result_ready_with_warning` share (events, by `reason_code`)       | Whether the warning (e.g. `FILE_TOO_SMALL`) and what to do next are clear.   |
| High `image_selected` with `accepted = false` (events, by `error_code`) | Which formats/sizes people bring; the rejection message.                     |

## Joining with on-site analytics

Search Console shows what happens **before** the click; `ANALYTICS.md` events show what
happens **after**. They can't be joined per user (no identifiers, by design). Join by page:
`page_view` with `referrer_category = organic_search` and `route` ≈ Search Console page clicks
(expect differences: blocked scripts, consent, anonymised queries), then that route's
`tool_select_rate` and `processing_completion_rate`.

## Rules

- No invented numbers: reports quote only real exports, with the date range and property.
- No SEO or conversion improvement is claimed without before/after data over comparable periods.
- Exports may contain queries typed by real people; keep them out of git (only the fake
  fixture is committed).
