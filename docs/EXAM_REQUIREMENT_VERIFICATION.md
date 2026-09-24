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
| Corrigendum-CRP-RRBs-XV-1.pdf                          | 15.09.2026 | Indicative vacancies (Annexure I)   | `86e92e11…22238b1e`  |
| Approved_Corrigendum-for-Extension_CRP-RRBs-XV-002.pdf | 21.09.2026 | Registration extended to 27.09.2026 | `39c3932b…25e629966` |

### Corroborating sources (same photograph text)

| Document                                                                                                | Section / page                      | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| CRP PO/MT-XVI Detailed Notification (dated 01.07.2026 per corrigendum; file `…Final_V1_30.06.2026.pdf`) | Annexure III, printed pp. 36 and 39 | `9379acfcad5750585ead182b5b0660fde89b324a8a2fa79dce9a9a9e69f73ebe` |
| CRP CSA-XVI Detailed Notification (PDF created 2026-07-31; registration 01.08–21.08.2026)               | Annexure IV, printed pp. 52 and 54  | `1c10773a0e692e0bfd7e0565724420ed4d05756420a88eb5805c684876c0f084` |

A normalized diff of the annexures shows only line wrapping and clause letters (J(ix)/K(ix)) differ.

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
