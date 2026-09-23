# Roadmap

## Phase 0 — Foundation ✅ (this phase)

Project setup, presets with source metadata, tool registry, SEO skeleton, validation model,
pure image helpers (geometry, size search, DPI choice, format sniffing), test infrastructure, docs.

## Phase 1 (P2): Image engine ✅

Web Worker engine: decode, EXIF orientation 1–8, crop (auto/rect/viewport), stepped resize,
white background, JPEG encode, KB search, JFIF DPI, metadata stripping, validation, typed
progress and errors. Below-minimum decision locked: report it, never pad. Unit and browser tests.

## Phase 2 — Tool UI

- Uploader (camera + gallery), crop UI (touch drag/zoom), live validation checklist, download.
- Replace `UploadPlaceholder`. CCC Complete Pack: three slots, one download each (zip optional, only if needed).
- Generic resizer/compressor inputs.

## Phase 3 — Launch

- Record official CCC sources → `verified`. Legal review. Analytics decision. Enable indexing.

## Phase 4 — Growth

- Guides that solve real rejection problems, linked to tools.
- Next exams (SSC, Railway, UPSC) — only after requirements are verified from official notices.
- Document tools (PDF size/compress) — later.

## Explicitly not planned for V1

Auth, database, payments, admin panel, AI features, server-side processing.
