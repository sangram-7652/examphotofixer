# Form Presets

Code: `src/lib/presets/`. Presets are the **only** place requirement numbers live.

## Schema (`ImagePreset`)

| Field                           | Meaning                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`                            | Stable id (`ccc-photo`). Used by tools, tests, analytics.                                           |
| `exam`, `documentType`, `label` | What it is.                                                                                         |
| `width`, `height`               | Exact output pixels.                                                                                |
| `fileSizeKB.min/max`            | KB exactly as written by the source.                                                                |
| `dpi.min/max`                   | Inclusive DPI range.                                                                                |
| `formats`                       | Accepted output formats (`"jpeg"`).                                                                 |
| `guidance`                      | Optional non-technical instructions from the same source (background, recency…), shown on the page. |
| `source.authority`              | Issuing organisation (e.g. NIELIT).                                                                 |
| `source.document`               | Title of the guidelines / notice.                                                                   |
| `source.url`                    | Official URL. `null` until recorded — **never guessed**.                                            |
| `source.version`                | Version as printed in the document.                                                                 |
| `source.published`              | Publication/revision date as printed.                                                               |
| `source.page`                   | Page containing the requirements.                                                                   |
| `source.sha256`                 | Hash of the source file when verified; a different hash means re-verify.                            |
| `source.verifiedOn`             | ISO date the values were last checked against the source.                                           |
| `source.status`                 | `verified` · `project-input` · `unverified`.                                                        |

## Current presets

Source for all CCC presets: **NIELIT CCC Examination Application Guidelines, Version 1.11 (2023)**
— <https://nva.nielit.gov.in/ccc/CCC_ExamGuideLine.pdf>, page 3 (sections A and B). Full title
in the document: “Guidelines and Instructions for Submission of Online Examination Application
Form (OEAF) and Examination Fee for Examination of Digital Literacy Courses (DLC)”. Verified
2026-09-24 against the PDF (SHA-256 `853cbfca…4a3475aa`, 14 pages, created 2023-06-14; every page
footer reads “Version1.11 (2023)”; the PDF's embedded title still names the 1.10 Word file).
Re-verified unchanged (identical SHA-256) on 2026-09-25.

| id               | Size (px) | KB   | DPI    | Format   | Status   |
| ---------------- | --------- | ---- | ------ | -------- | -------- |
| `ccc-photo`      | 132 × 170 | 5–50 | 96–300 | JPG/JPEG | verified |
| `ccc-signature`  | 170 × 132 | 5–20 | 96–200 | JPG/JPEG | verified |
| `ccc-left-thumb` | 170 × 132 | 5–20 | 96–200 | JPG/JPEG | verified |

The same page also says the photograph should be a colour photo taken professionally (not on a
mobile phone) within the last six months, with a white background, face clearly visible; and
that signature/LTI should be on white paper in black/blue ink, not blurred or smudged. These are
stored as `guidance`, worded per document (signature vs. left thumb impression). All CCC presets
share one frozen `source` object.

**Versions matter.** Older versions of the NIELIT guidelines list different values. Values are
always shown together with the version and date they come from; never present a historical
value as current. When a new version appears, update `source` and the numbers in one change.

Source for all IBPS presets: **IBPS CRP RRBs XV Detailed Notification (01.09.2026)** —
<https://www.ibps.in/wp-content/uploads/CRP-RRBs-XV-notification.pdf>, Annexure III (SHA-256
`105b0652…1b760508`). Photograph printed page 56; signature, left thumb impression and
hand-written declaration page 57; JPG/JPEG and "minimum of 200 dpi" for every image page 58
(`sourcePages`). Same text in CRP PO/MT-XVI and SPL-XVI. Verified 2026-09-24 (photo),
re-verified unchanged and extended to the other three images on 2026-09-25.

| id                 | Size (px), preferred | KB     | DPI         | Format   | Status   |
| ------------------ | -------------------- | ------ | ----------- | -------- | -------- |
| `ibps-photo`       | 200 × 230            | 20–50  | 200 or more | JPG/JPEG | verified |
| `ibps-signature`   | 140 × 60             | 10–20  | 200 or more | JPG/JPEG | verified |
| `ibps-left-thumb`  | 240 × 240            | 20–50  | 200 or more | JPG/JPEG | verified |
| `ibps-declaration` | 800 × 400            | 50–100 | 200 or more | JPG/JPEG | verified |

SSC, Railway and UPSC exist in `EXAMS` as `planned` with **no presets**. A test enforces this.
Why (P12 evaluation): `REQUIREMENT_MONITORING.md` → "Candidates evaluated".

**Version history.** Every verification (first check, re-check, change) is an event in
`src/lib/presets/history.ts` with the source checksum and a snapshot of the values; a test
fails if a preset differs from its latest snapshot. Change values only by adding a new event.

## Verification rules

1. Never add or change a number without an official source (notification PDF, official
   application portal instructions). Third-party blogs are not sources.
2. Record URL, document title, version, published date, page, SHA-256 of the file and today's
   date in `source`. To re-verify: download the file, compare `sha256sum`; if it differs, re-read
   the requirement page and update values/version.
3. If sources conflict, use the most recent official notification and note the conflict in `source.notes`.
4. Presets marked `verified` must have `url` (https), `verifiedOn`, `document`, `version` and
   `published` — enforced in `presets.test.ts`.
5. Re-verify each active preset at least every 6 months and whenever a new exam cycle opens.
6. Update the CCC test in `presets.test.ts` in the same change; the diff must show the source.

## IBPS (P8)

| id           | Size (px)             | KB    | DPI                                        | Format   | Status   |
| ------------ | --------------------- | ----- | ------------------------------------------ | -------- | -------- |
| `ibps-photo` | 200 × 230 (preferred) | 20–50 | ≥ 200 (scanner minimum; no maximum stated) | JPG/JPEG | verified |

Source: IBPS CRP RRBs XV Detailed Notification (01.09.2026), Annexure III, printed pages 56 and 58.
Full audit trail: `EXAM_REQUIREMENT_VERIFICATION.md`. `DpiRange.max` may be `null` when a source
states only a minimum; `preferredDimensions` marks sizes the source calls "preferred".
