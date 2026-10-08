# Exam Requirement Verification

How every exam preset value was verified, so another developer can audit it. Values live only in
`src/lib/presets/*.ts`; everything else (tool UI, validation, guides, metadata) derives from them.

## Verification procedure

1. Find the **official** document on the authority's own domain (no blogs, coaching sites, videos).
2. Download it over **verified TLS**. If the server omits an intermediate certificate (as
   `www.ibps.in` does), fetch the intermediate from the certificate's own AIA URL and verify
   against the system trust store plus that intermediate — never disable verification.
3. Record SHA-256 (`sha256sum file.pdf`), PDF metadata (`pdfinfo`) and the printed page numbers.
4. Extract the text (`pdftotext -layout`) and read the requirement section verbatim.
5. Check corrigenda issued for the same notification.
6. Compare with sibling documents if the preset claims wider applicability.
7. Enter values in a preset with `source` (authority, document, url, version, published, page,
   sha256, verifiedOn, status, notes). Don't fill unspecified fields with guesses.
8. A later change is a **new verification event**: update values and `source` together, and add a
   row to the history below — don't overwrite silently.

## CCC (NIELIT) — photo, signature, left thumb impression

See `FORM_PRESETS.md` (Version 1.11 (2023), page 3, verified 2026-09-24, SHA-256 `853cbfca…4a3475aa`).

**Page-number re-confirmation (2026-10-08).** A P13 trust audit flagged that a PDF viewer showed
the specification on page 4 and asked whether the "page 3" citation uses the printed page number
or the viewer's page index. Re-downloaded the source (identical SHA-256 `853cbfca…4a3475aa`,
confirming the same, already-verified document) and read it with `pdftotext -layout -f 3 -l 4`:
the printed footer on PDF page 3 itself reads "3 Version1.11 (2023)", and PDF page 4's footer
reads "4 Version1.11 (2023)" — this document has no cover-page offset, so the PDF page index
and the printed page number are identical here. **"Page 3" is correct and unchanged** (the
auditor's "page 4" observation isn't reproducible against this file).

The same page 3 extract also gives, for each document, a physical print size not previously
recorded in any preset:

| Source text                                         | Preset field                                                                      | Validated automatically?                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Photo: "Size- 3.5 cm Width X 4.5 cm Height"         | `ccc-photo` `physicalSize: { widthCm: 3.5, heightCm: 4.5 }`                       | **No** — informational; the pixel size governs |
| Signature/LTI: "Size- 4.5 cm Width X 3.5 cm Height" | `ccc-signature`, `ccc-left-thumb` `physicalSize: { widthCm: 4.5, heightCm: 3.5 }` | **No** — informational; the pixel size governs |

No tracked value (width/height/KB/DPI/format) changed, so this isn't a new entry in
`history.ts`/`RequirementSnapshot` — `physicalSize` is informational only, the same way
`guidance` is, and isn't part of the change-tracked snapshot.

## IBPS — photograph (`ibps-photo`, P8)

### Why IBPS

Candidates considered (September 2026): SSC, Railway (RRB), UPSC, IBPS.

| Candidate     | Finding                                                                                                                                                | Decision         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| SSC           | Photo is captured live via webcam/app during application; an upload tool can't satisfy it.                                                             | Not selected     |
| UPSC          | Photo must show the candidate's name and date; would need a new text-on-image feature.                                                                 | Not selected     |
| Railway (RRB) | Specifications differ between notifications (CENs); third-party summaries conflict.                                                                    | Not selected now |
| IBPS          | Explicit pixel, KB, format and DPI instructions; identical text across its current Common Recruitment Process notifications; official PDFs on ibps.in. | **Selected**     |

Selection was based on source quality and implementation clarity, not on which exam is "best".

### Canonical source

| Field     | Value                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority | Institute of Banking Personnel Selection (IBPS)                                                                                                                              |
| Document  | CRP RRBs XV — Common Recruitment Process for Recruitment of Officers (Scale-I, II & III) and Office Assistants (Multipurpose) in Regional Rural Banks: Detailed Notification |
| URL       | https://www.ibps.in/wp-content/uploads/CRP-RRBs-XV-notification.pdf                                                                                                          |
| Published | 01.09.2026 (as stated in IBPS corrigenda: "Detailed Notification dated 01.09.2026")                                                                                          |
| Section   | Annexure III: Guidelines for Scanning and Upload of Documents                                                                                                                |
| Pages     | Photograph: printed page 56 (PDF page 58). Format and scanner resolution: printed page 58 (PDF page 60)                                                                      |
| SHA-256   | `105b0652fb7f2564adc452685248734e8546235b332b84c93f81acdb1b760508` (1,549,821 bytes, 76 pages)                                                                               |
| Verified  | 2026-09-24                                                                                                                                                                   |

**Discrepancy recorded:** the PDF's embedded creation date is 2026-08-31 19:48 IST; IBPS's printed
corrigenda call it the notification dated 01.09.2026. The printed/public date is used.

Corrigenda checked (both leave image specifications unchanged — "All other terms & conditions … remain unchanged"):

| Corrigendum                                            | Date       | Change                              | SHA-256              |
| ------------------------------------------------------ | ---------- | ----------------------------------- | -------------------- |
| Corrigendum-CRP-RRBs-XV-1.pdf                          | 15.09.2026 | Indicative vacancies (Annexure I)   | `86e92e11…ccd1f8b3a` |
| Approved_Corrigendum-for-Extension_CRP-RRBs-XV-002.pdf | 21.09.2026 | Registration extended to 27.09.2026 | `39c3932b…25e629966` |

### Corroborating sources (same photograph text)

| Document                                                                                                | Section / page                      | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| CRP PO/MT-XVI Detailed Notification (dated 01.07.2026 per corrigendum; file `…Final_V1_30.06.2026.pdf`) | Annexure III, printed pp. 36 and 39 | `9379acfcad5750585ead182b5b0660fde89b324a8a2fa79dce9a9a9e69f73ebe` |
| CRP CSA-XVI Detailed Notification (PDF created 2026-07-31; registration 01.08–21.08.2026)               | Annexure IV, printed pp. 52 and 54  | `1c10773a0e692e0bfd7e0565724420ed4d05756420a88eb5805c684876c0f084` |

A normalized diff of the annexures shows only line wrapping and clause letters (J(ix)/K(ix)) differ.

**Citation wording (2026-10-08).** A P13 trust audit found pages showing "Version XV" — "XV"
names this recruitment cycle, not a document revision, which reads as a more general IBPS
version than this preset actually covers. Fixed by moving "XV" into `source.document` ("CRP
RRBs-XV Detailed Notification"); `versionFragment` (`lib/presets/source.ts`) then skips the
redundant version fragment wherever it's already named in `document`. A `source.scopeNote` was
also added, shown in the "Source and verification" section on every IBPS tool and guide page:
these values are verified for CRP RRBs-XV only, not IBPS PO, Clerk, SO or any other recruitment.

### Exact requirements (verbatim excerpts) → preset mapping

| Source text                                                                                                                                                                                            | Preset field                                                                    | Validated automatically?                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------- |
| "Dimensions 200 x 230 pixels (preferred)"                                                                                                                                                              | `width: 200`, `height: 230`, `preferredDimensions: true`                        | Yes — output is exactly 200 × 230        |
| "Size of file should be between 20kb–50 kb" / "not more than 50kb"                                                                                                                                     | `fileSizeKB: { min: 20, max: 50 }` (bytes: 20 × 1024 … 50 × 1000, conservative) | Yes (below minimum → warning)            |
| "The image file should be JPG or JPEG format"                                                                                                                                                          | `formats: ["jpeg"]`                                                             | Yes (magic bytes)                        |
| "Set the scanner resolution to a minimum of 200 dpi"                                                                                                                                                   | `dpi: { min: 200, max: null }` (no maximum stated)                              | Yes — 200 DPI written; ≥ 200 checked     |
| "recent passport style colour picture", "light-coloured, preferably white, background", straight look, no caps/hats/dark glasses, religious headwear allowed if face uncovered, no glasses reflections | `guidance` (shown on the page)                                                  | **No** — the engine can't verify content |
| "candidates will also be required to capture and upload their photograph either by using webcam or their mobile phone"                                                                                 | `guidance` + guide section                                                      | **No** — happens on the IBPS site        |
| "Photograph Image: (4.5cm × 3.5cm)"                                                                                                                                                                    | not used (physical print size; the pixel size governs the upload)               | —                                        |

Not implemented in P8 (verified in the same annexure, for future presets): signature 140 × 60 px
(preferred), 10–20 KB; left thumb impression 240 × 240 px in 200 DPI, 20–50 KB, JPG/JPEG;
hand-written declaration 800 × 400 px in 200 DPI, 50–100 KB, JPG/JPEG.

### Ambiguities

- "Preferred" dimensions: IBPS doesn't say other sizes are rejected; the tool uses the preferred
  size exactly and says it is "stated as preferred".
- DPI is phrased as a scanner setting; the tool writes 200 DPI into the JPEG, satisfying the minimum.
- "KB" base isn't defined; the conservative window (min × 1024, max × 1000) satisfies both readings.

### Implementation mapping

| Concern             | Where it comes from                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preset              | `src/lib/presets/ibps.ts` (`IBPS_PHOTO`, frozen `source`)                                                                                                 |
| Tool                | `/ibps-photo-resizer` → registry `ibps-photo` → `ToolPage` → `ImageTool` (shared engine)                                                                  |
| Requirement display | `RequirementsSummary`, `RequirementsTable`, `describePreset`/`dpiText`                                                                                    |
| Source display      | `SourceVerification` / `SourceLink`                                                                                                                       |
| Validation          | `validateAgainstPreset(preset, facts)` in the worker                                                                                                      |
| Guide               | `/guides/ibps-photo-size` (`src/content/guides.ts`)                                                                                                       |
| Tests               | `presets.test.ts` (exact values + source), `guides.test.ts` / `tool-ui.test.ts` (drift), `validate.test.ts` (min-only DPI), `e2e/ibps-photo-tool.spec.ts` |

### Re-verification

At each new IBPS Common Recruitment Process notification: repeat the procedure, compare Annexure
III text, and if values or wording change, update `ibps.ts` and add a history row.

### History

| Date       | Event                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| 2026-09-24 | Initial verification against CRP RRBs XV (01.09.2026); corroborated by PO/MT-XVI and CSA-XVI. |

## Source change workflow and tooling (P12)

Re-verification triggers, statuses and the step-by-step workflow are in
`REQUIREMENT_MONITORING.md`. Tooling (developer-side, read-only, nothing is uploaded):

```
npm run source:checksum -- <downloaded.pdf> --source <source-id>   # UNCHANGED (exit 0) / CHANGED (exit 3)
npm run source:checksum -- --list                                  # recorded checksums
npm run requirements:report                                        # status + audit of every preset
npm run requirements:report -- --impact <preset-id>                # what a change touches
```

Record every check as a new event in `src/lib/presets/history.ts`; never edit a past event.

## Re-verification, 2026-09-25 (P12)

Both sources were downloaded again from the official domains with certificate verification on
(for `www.ibps.in` the missing GlobalSign intermediate was fetched from the certificate's AIA URL,
as above; chain: `*.ibps.in` ← GlobalSign RSA OV SSL CA 2018 ← GlobalSign Root R3).

| Source                              | SHA-256 today                     | Result    |
| ----------------------------------- | --------------------------------- | --------- |
| NIELIT CCC guidelines, Version 1.11 | `853cbfca…4a3475aa` (2,585,888 B) | UNCHANGED |
| IBPS CRP RRBs XV notification       | `105b0652…1b760508` (1,549,821 B) | UNCHANGED |

All documents listed on IBPS's RRB XV page (`/index.php/rural-bank-xv/`) were checked; none
mentions image specifications:

| Document                                               | Date          | Content                                                                           | SHA-256                   |
| ------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------- | ------------------------- |
| Corrigendum-CRP-RRBs-XV.pdf                            | 09.09.2026    | Indicative vacancies; "all other terms … remain unchanged" (not in the P8 record) | `89211d50…e4aabbf8`       |
| Corrigendum-CRP-RRBs-XV-1.pdf                          | 15.09.2026    | Vacancies                                                                         | `86e92e11…ccd1f8b3a`      |
| Approved_Corrigendum-for-Extension_CRP-RRBs-XV-002.pdf | 21.09.2026    | Registration extended to 27.09.2026                                               | `39c3932b…25e629966`      |
| Annexure-I_updated09.09.2026.pdf / _15.09.2026.pdf     | 09/15.09.2026 | Vacancy tables                                                                    | `dd77db3b…` / `667a95d9…` |
| Window-Notification_CRP-RRBs-XV.pdf                    | 31.08.2026    | Window notification                                                               | `9a29b3d6…621e4dbb8`      |

### IBPS signature, left thumb impression, hand-written declaration (P12)

Printed page 57 (PDF page 59), Annexure III, CRP RRBs XV; the same text (punctuation and line
wraps aside) is in CRP PO/MT-XVI (`9379acfc…`, unchanged since P8) and CRP SPL-XVI
(`2293242c…3d72154bd`, 59 pages).

| Source text (verbatim)                                                                                                             | Preset field                                                   | Validated?                |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Signature: "Dimensions 140 x 60 pixels (preferred)"                                                                                | `ibps-signature` 140 × 60, `preferredDimensions`               | Yes                       |
| "Size of file should be between 10kb – 20kb" / "not more than 20kb"                                                                | `fileSizeKB: { min: 10, max: 20 }`                             | Yes (below min → warning) |
| "sign on white paper with Black Ink pen"; "Not in CAPITAL LETTERS"; own signature; mismatch at exam → disqualification             | `guidance`                                                     | No                        |
| Left Thumb Impression: "File type: jpg / jpeg"; "240 x 240 pixels in 200 DPI (Preferred for required quality) i.e 3 cm * 3 cm"     | `ibps-left-thumb` 240 × 240, preferred, JPEG                   | Yes                       |
| "File Size: 20 KB – 50 KB"                                                                                                         | `fileSizeKB: { min: 20, max: 50 }`                             | Yes                       |
| "white paper with black or blue ink"; missing-thumb substitutions and labelling                                                    | `guidance`                                                     | No                        |
| Hand-written declaration: "File type: jpg / jpeg"; "800 x 400 pixels in 200 DPI (Preferred for required quality) i.e 10 cm * 5 cm" | `ibps-declaration` 800 × 400, preferred, JPEG                  | Yes                       |
| "File Size: 50 KB – 100 KB"                                                                                                        | `fileSizeKB: { min: 50, max: 100 }`                            | Yes                       |
| English only, own handwriting, black ink, not in capitals; typed text + LTI for candidates who cannot write                        | `guidance`; the declaration text is quoted in the guide        | No                        |
| Page 58: "Set the scanner resolution to a minimum of 200 dpi"; "The image file should be JPG or JPEG format"                       | `dpi: { min: 200, max: null }`, `formats: ["jpeg"]` (all four) | Yes                       |

Browser finding (P12 e2e): at maximum quality WebKit (Safari) encodes JPEGs smaller than
Chromium and Firefox (measured for 140 × 60 random noise: WebKit 13,714 B, Chromium 27,705 B,
Firefox 38,179 B). Real signatures (dark ink on white) compress far more, so a 140 × 60
signature can fall below the 10 KB minimum, especially in Safari. The tool keeps the
highest-quality file and shows a warning; it never pads the file (locked product decision).

Ambiguities: as for the photo ("preferred" sizes, DPI as a scanner setting, KB base). The
declaration's text could differ in other notifications: the guide tells users to copy it from
their own notification. Need: the notification states the application "will not be registered
unless you upload your Photograph, signature, left thumb impression, hand written declaration"
(printed p. 59), so the photo tool alone didn't let a candidate finish.

## Candidates evaluated, 2026-09-25 (P12)

| Candidate | Official evidence checked                                                                                                                                                                                  | Finding                                                                                                                                                                                                                           | Decision                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| SSC       | `ssc.gov.in` notices: ASO 2026 (`Notice_of_ASO_2026_06_25.pdf.pdf`, `7048f0bc…`), CTGD 2026 (`Notice_of_CTGD_2026.pdf`, `0d849077…`)                                                                       | Photo: "The application module has been designed to capture a photograph of the candidate"; pre-existing photos → rejection. Signature: "JPEG format (10 to 20 KB)", "about 6.0 cm (width) x 2.0 cm (height)" — no pixels or DPI. | Photo: not applicable. Signature: blocked (not explicit).                  |
| Railway   | `rrbcdg.gov.in` (certificate valid only for the bare domain; now redirects to `rrb.indianrailways.gov.in`), whose document endpoint rejects scripted requests; `rrbchennai.gov.in` failed TLS verification | No current CEN document obtained over verified TLS. Requirements are notification-specific (P8).                                                                                                                                  | Blocked (source). Needs a person to download the current CEN in a browser. |
| UPSC      | `upsc.gov.in`: CSE 2026 notification (`Notif-CSP-2026-Engl-060226Rev.pdf`, `f68a7de9…`), NOTE 2                                                                                                            | Upload **and** live capture required; specifications are on `upsconline.nic.in` → "Instructions … Photos and Signature", behind the candidate portal's login redirect.                                                            | Blocked (source).                                                          |

Search results were used only to locate official URLs; nothing was taken from them as evidence.

### History (continued)

| Date       | Event                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | CCC and IBPS sources re-verified: identical checksums (UNCHANGED). IBPS signature, left thumb, declaration added.                                                                             |
| 2026-09-25 | `ibps-photo` citation corrected to pages 56 and 58 (values unchanged).                                                                                                                        |
| 2026-09-25 | Correction: the 15.09.2026 corrigendum's SHA-256 was recorded in P8 with a wrong suffix (`…22238b1e`); the file's hash is `86e92e11380ec4e1a478eb110e2207eeba61e761ab138d56e5f75c6ccd1f8b3a`. |
