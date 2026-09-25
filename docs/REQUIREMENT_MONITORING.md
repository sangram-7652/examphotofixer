# Requirement monitoring

The operational source of truth for keeping exam requirements correct. Values live only in
`src/lib/presets/`; every verification is an event in `src/lib/presets/history.ts`; the table
below is generated from them (`npm run requirements:report -- --write`) and a unit test fails if
it drifts. How to verify a source: `EXAM_REQUIREMENT_VERIFICATION.md`.

## Active presets

<!-- prettier-ignore-start -->
<!-- BEGIN GENERATED: npm run requirements:report -- --write -->

Status as of 2026-09-25. Review interval: 90 days after the last verification event.

| Exam | Asset | Preset | Source (version, published) | SHA-256 | Verified | Review after | Status | Last check | Versions |
| ---- | ----- | ------ | --------------------------- | ------- | -------- | ------------ | ------ | ---------- | -------- |
| CCC | Photo | `ccc-photo` | `nielit-ccc-guidelines-v1.11` (1.11, 2023) | `853cbfca5300…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |
| CCC | Signature | `ccc-signature` | `nielit-ccc-guidelines-v1.11` (1.11, 2023) | `853cbfca5300…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |
| CCC | Left thumb impression | `ccc-left-thumb` | `nielit-ccc-guidelines-v1.11` (1.11, 2023) | `853cbfca5300…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |
| IBPS | Photo | `ibps-photo` | `ibps-crp-rrbs-xv-notification` (XV, 01.09.2026) | `105b0652fb7f…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |
| IBPS | Signature | `ibps-signature` | `ibps-crp-rrbs-xv-notification` (XV, 01.09.2026) | `105b0652fb7f…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |
| IBPS | Left thumb impression | `ibps-left-thumb` | `ibps-crp-rrbs-xv-notification` (XV, 01.09.2026) | `105b0652fb7f…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |
| IBPS | Hand-written declaration | `ibps-declaration` | `ibps-crp-rrbs-xv-notification` (XV, 01.09.2026) | `105b0652fb7f…` | 2026-09-25 | 2026-12-24 | **VERIFIED** | UNCHANGED | 1 |

<!-- END GENERATED -->
<!-- prettier-ignore-end -->

Columns: **Verified** = date of the latest verification event for the source; **Review after** =
verified + 90 days; **Last check** = outcome of that event (`INITIAL`, `UNCHANGED`, `CHANGED`,
`UNCERTAIN`); **Versions** = distinct requirement versions recorded for the preset (older ones
are `SUPERSEDED` and kept in the history).

## Statuses

| Status           | Meaning                                                                                  | Set by                                             |
| ---------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `VERIFIED`       | Latest event is INITIAL/UNCHANGED and the review date hasn't passed.                     | computed                                           |
| `REVIEW_DUE`     | Review date passed. A signal to re-check, **not** a verdict: values stay live and shown. | computed                                           |
| `SOURCE_CHANGED` | The source file or text changed (checksum differs, new notification, corrigendum).       | a person (`SOURCE_STATES`) or a `CHANGED` event    |
| `UNDER_REVIEW`   | Someone is comparing the source, or the last comparison was `UNCERTAIN`.                 | a person (`SOURCE_STATES`) or an `UNCERTAIN` event |
| `SUPERSEDED`     | An older requirement version, kept in the history for reference.                         | computed per version                               |

## Re-verification policy

Re-verify a source (procedure in `EXAM_REQUIREMENT_VERIFICATION.md`) when:

1. A new official notification is published for the exam (e.g. the next IBPS CRP round).
2. Application dates change (an extension corrigendum is a reason to re-read, even if only dates change).
3. An official corrigendum appears for the notification.
4. The requirement text on the official page or PDF changes.
5. The source checksum changes (`npm run source:checksum -- <file> --source <id>` → `CHANGED`).
6. Users repeatedly report a discrepancy (see "Discrepancy reports").
7. Search data suggests a changed requirement (opportunity type `REVERIFY_SOURCE`).
8. The review date arrives (`REVIEW_DUE`).

Search snippets, coaching sites, blogs and videos are **signals only**. Evidence is the official
document, downloaded from the authority's own domain over verified TLS, with its checksum.

## Source change workflow

```
source discovered (new notice, corrigendum, checksum change, report)
  → download from the official domain over verified TLS (never disable certificate checks)
  → npm run source:checksum -- <file> --source <id>        # UNCHANGED / CHANGED
  → read the requirement pages verbatim (pdftotext -layout), check corrigenda
  → outcome: UNCHANGED / CHANGED / UNCERTAIN
  → set SOURCE_STATES while a person reviews (UNDER_REVIEW / SOURCE_CHANGED)
  → manual verification by a person
  → preset update (only for CHANGED) + a new history event (never edit old events)
  → guide/tool copy check: npm run requirements:report -- --impact <preset-id>
  → tests (unit + full browser matrix) → release → regenerate this document
```

Nothing is automatic beyond detection: tooling may open a review, but **no requirement is ever
changed by a script, a changed checksum or search data**.

## Discrepancy reports

A single report ("the portal rejected my image") never changes a preset. Record it here:

| Date | Exam | Asset | Requirement version (source id, verified) | Reported issue | Reproduced? | Official source check | Outcome | Resolution |
| ---- | ---- | ----- | ----------------------------------------- | -------------- | ----------- | --------------------- | ------- | ---------- |
| —    | —    | —     | —                                         | none received  | —           | —                     | —       | —          |

Outcomes: `SOURCE_CONFIRMED` (our values match the current source), `USER_CONFIGURATION_ISSUE`
(e.g. wrong file uploaded, different exam), `PORTAL_BEHAVIOR_UNCONFIRMED` (portal differs from
its own published rules; can't be confirmed), `REQUIREMENT_CHANGED` (a newer official source
differs → source change workflow), `UNKNOWN`. Record no personal data (no names, emails, files).

## Audit, 2026-09-25 (P12)

Checked every preset for exam, asset, dimensions, size, format, DPI, notes, authority, title,
URL, version/date, page, verification date, checksum and ambiguity notes
(`auditPreset` in `src/lib/requirements/monitoring.ts`; `requirements:report` prints it).

| Finding                                                                                                                              | Action                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| CCC source downloaded again: identical SHA-256.                                                                                      | UNCHANGED event recorded; `verifiedOn` 2026-09-25. No value changed.                                          |
| IBPS RRB XV notification downloaded again: identical SHA-256. All 6 other RRB XV documents on ibps.in checked; none mentions images. | UNCHANGED event recorded; `verifiedOn` 2026-09-25. No value changed.                                          |
| The P8 record of the 15.09.2026 corrigendum had a mistyped checksum suffix (prefix correct).                                         | Corrected in `EXAM_REQUIREMENT_VERIFICATION.md` with the full hash, noted in its history.                     |
| A corrigendum dated 09.09.2026 (vacancies) was not in the P8 record.                                                                 | Added to the history notes and `EXAM_REQUIREMENT_VERIFICATION.md`; no image change.                           |
| `ibps-photo` cited only printed page 56, but its format and DPI rules are on page 58.                                                | Added `sourcePages: [56, 58]`; pages now cite both. Values unchanged.                                         |
| No history existed; verification dates were only in `source.verifiedOn`.                                                             | `history.ts` created with the P4/P8 events and today's; test requires presets to match their latest snapshot. |
| No missing sources, no unverified presets, no duplicated requirement values outside `src/lib/presets` (drift tests pass).            | —                                                                                                             |
| Ambiguities ("preferred" dimensions, DPI as a scanner setting, KB base) documented for IBPS; CCC in `FORM_PRESETS.md`.               | Carried over to the new IBPS presets.                                                                         |

## Candidates evaluated 2026-09-25 (P12)

Decision sequence: official source available → current requirements explicit → implementable
→ clear need → auditable. Details and evidence: `EXAM_REQUIREMENT_VERIFICATION.md`.

| Candidate                     | Result                                                                                                                                                                                               | Status             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| IBPS signature                | Re-verified from the current notification; explicit; implementable; required to register.                                                                                                            | **Implemented**    |
| IBPS left thumb impression    | Same.                                                                                                                                                                                                | **Implemented**    |
| IBPS hand-written declaration | Same; handwriting, language and capitals are guidance only.                                                                                                                                          | **Implemented**    |
| SSC photograph                | Current notices (ASO 2026, CTGD 2026): photo is captured live in the application; no uploadable photo.                                                                                               | Not applicable     |
| SSC signature                 | "JPEG (10 to 20 KB)", "about 6.0 cm × 2.0 cm": no pixel size or DPI, approximate. Not explicit enough.                                                                                               | Blocked (explicit) |
| Railway (RRB)                 | Current CEN documents not retrievable from an official source with verified TLS here (portal firewall; certificate mismatch / verification failure on regional sites). Notification-specific anyway. | Blocked (source)   |
| UPSC                          | Notification (CSE 2026) requires an uploaded **and** a live photo; specifications are on the candidate portal's instruction page, behind a login redirect: no citable public document.               | Blocked (source)   |
| IBPS upload-problems guide    | No problem-query evidence (no search data).                                                                                                                                                          | Deferred (need)    |
