# Privacy

## Commitments (V1)

1. User files are processed entirely in the browser. They are never uploaded, stored or logged.
2. No accounts, no database, no cookies for tracking.
3. Output files are stripped of EXIF/GPS/camera metadata (only JFIF density is written).
4. Analytics, if any, never include file contents, names or image-derived data (see ANALYTICS.md).

## Engineering rules

- No `fetch`/`XMLHttpRequest`/`sendBeacon` carrying file data. Code review must reject it.
- No third-party scripts on tool pages except the chosen analytics.
- Object URLs are revoked and bitmaps closed after use.
- Error reporting (if added) must scrub file names and never attach image data.
- A future CSP should set `connect-src 'self'` plus analytics origin only.

## User-facing policy

`/privacy` (`src/app/privacy/page.tsx`) is a **draft** and needs legal review before launch.
Keep it consistent with this document.
