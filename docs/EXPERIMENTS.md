# Experiments

A lightweight log for growth experiments. Rules:

- An experiment starts only when its data source exists and a baseline has been recorded.
  Until the site is live, every experiment below is **not started**.
- The outcome is never predefined. "Result" is filled in with observed values, the date range
  and the source; "Decision" follows from them (keep, revert, extend, inconclusive).
- One change per page at a time, so a result can be attributed. Search Console data lags about
  two days and is noisy at low volume: use comparable periods (e.g. 28 days before vs after)
  and don't conclude from small numbers.
- Every SEO change also gets an `SEO_CHANGELOG.md` entry.
- No dark patterns: an experiment may never hide requirements, add fake urgency, obstruct
  downloads or make claims the site can't back.

Template:

```
## EXP-NNN — <short name>
- Hypothesis:
- Page/tool:
- Change:
- Start date:
- Baseline metric: <value, date range, source>
- Success metric:
- Data source:
- Review date:
- Result:
- Decision:
```

## EXP-001 — requirement-focused titles

- Hypothesis: a title that states the exact requirement being solved improves relevant search
  CTR for requirement queries on that page.
- Page/tool: one requirement guide or tool page chosen by the opportunity report
  (`OPTIMIZE_EXISTING_PAGE`, position ≤ 10, CTR below threshold).
- Change: rewrite title and meta description to state the verified requirement and what the
  page does (values from the preset, no "official", "guaranteed" or "best").
- Start date: not started (site not live; no Search Console data).
- Baseline metric: to be recorded (page CTR and impressions, 28 days, Search Console).
- Success metric: CTR for the page's requirement queries over 28 days after the change vs the
  baseline, at a comparable average position.
- Data source: Search Console export analysed with `npm run search:report`.
- Review date: 28 days after start.
- Result: —
- Decision: —

## EXP-002 — guide → tool link placement

- Hypothesis: showing the tool link right after the requirement table increases guide → tool
  clicks per guide view.
- Page/tool: one guide whose top queries are tool-intent (`ADD_INTERNAL_LINK` proposals).
- Change: move or repeat the primary tool link directly below the requirements table.
- Start date: not started (needs an analytics provider and traffic).
- Baseline metric: `guide_tool_clicked` per guide `page_view` (engagement report), at least
  the minimum sample.
- Success metric: same ratio over a comparable period.
- Data source: analytics export analysed with `npm run analytics:report` / `search:report --events`.
- Review date: 28 days after start.
- Result: —
- Decision: —
