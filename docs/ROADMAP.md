# Roadmap

## Phase 0 — Foundation ✅ (this phase)

Project setup, presets with source metadata, tool registry, SEO skeleton, validation model,
pure image helpers (geometry, size search, DPI choice, format sniffing), test infrastructure, docs.

## Phase 1 — Image pipeline

- Web Worker pipeline: decode (`createImageBitmap`), EXIF orientation, crop, high-quality resize, white background, JPEG encode.
- JFIF density writer/reader; metadata stripping.
- Wire `findQualityForByteWindow`; decide "too small" strategy.
- Browser tests for every `it.todo` in `pipeline.test.ts`, with fixtures.

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
