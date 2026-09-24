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

SSC, Railway and UPSC exist in `EXAMS` as `planned` with **no presets**. A test enforces this.

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
