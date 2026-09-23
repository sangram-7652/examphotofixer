# Form Presets

Code: `src/lib/presets/`. Presets are the **only** place requirement numbers live.

## Schema (`ImagePreset`)

| Field                           | Meaning                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `id`                            | Stable id (`ccc-photo`). Used by tools, tests, analytics. |
| `exam`, `documentType`, `label` | What it is.                                               |
| `width`, `height`               | Exact output pixels.                                      |
| `fileSizeKB.min/max`            | KB exactly as written by the source.                      |
| `dpi.min/max`                   | Inclusive DPI range.                                      |
| `formats`                       | Accepted output formats (`"jpeg"`).                       |
| `source.authority`              | Conducting body (e.g. NIELIT).                            |
| `source.document`               | Notice / page title.                                      |
| `source.url`                    | Official URL. `null` until recorded — **never guessed**.  |
| `source.version`                | Edition/date of the source document.                      |
| `source.verifiedOn`             | ISO date a person last checked it.                        |
| `source.status`                 | `verified` · `project-input` · `unverified`.              |

## Current presets

| id               | Size (px) | KB   | DPI    | Format   | Status        |
| ---------------- | --------- | ---- | ------ | -------- | ------------- |
| `ccc-photo`      | 132 × 170 | 5–50 | 96–300 | JPG/JPEG | project-input |
| `ccc-signature`  | 170 × 132 | 5–20 | 96–200 | JPG/JPEG | project-input |
| `ccc-left-thumb` | 170 × 132 | 5–20 | 96–200 | JPG/JPEG | project-input |

`project-input`: values supplied as verified by the project owner; the official source URL,
document title and version are **not yet recorded**. Record them and set `status: "verified"`
and `verifiedOn` before launch.

SSC, Railway and UPSC exist in `EXAMS` as `planned` with **no presets**. A test enforces this.

## Verification rules

1. Never add or change a number without an official source (notification PDF, official
   application portal instructions). Third-party blogs are not sources.
2. Record URL, document title, version/date and today's date in `source`.
3. If sources conflict, use the most recent official notification and note the conflict in `source.notes`.
4. Presets marked `verified` must have `url` (https) and `verifiedOn` — enforced in `presets.test.ts`.
5. Re-verify each active preset at least every 6 months and whenever a new exam cycle opens.
6. Update the CCC test in `presets.test.ts` in the same change; the diff must show the source.
