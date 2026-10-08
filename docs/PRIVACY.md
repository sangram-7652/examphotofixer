# Privacy

## Commitments (V1)

1. User files are processed entirely in the browser. They are never uploaded, stored or logged.
2. No accounts, no database, no cookies (e2e asserts none are set while using a tool; the
   optional GA4 provider is configured cookieless, so this holds whether or not it's enabled).
3. Output files are stripped of EXIF/GPS/camera metadata (only JFIF density is written).
4. Analytics events are allowlisted and sanitized: never file contents, names, EXIF/GPS,
   typed text or personal data; image facts only as coarse buckets (see ANALYTICS.md). An
   optional GA4 provider (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) can receive these same sanitized
   events; with no measurement ID configured, events stay in the browser and nothing is sent.

## Engineering rules

- No `fetch`/`XMLHttpRequest`/`sendBeacon` carrying file data. Code review must reject it.
- No third-party scripts on tool pages except the chosen analytics.
- Object URLs are revoked and bitmaps closed after use.
- Error reporting (if added) must scrub file names and never attach image data.
- Security headers and the CSP live in `src/config/security-headers.ts`. `connect-src 'self' blob:`
  means the browser refuses to send anything to another origin; widening it requires a
  documented reason and an update to `/privacy`.

## User-facing policy

`/privacy` (`src/app/privacy/page.tsx`) and `/terms` are **drafts** and need legal review
before launch (launch blocker, see `PRODUCTION_LAUNCH_CHECKLIST.md`). Keep them consistent
with this document; `e2e/launch.spec.ts` checks the key statements. The contact address comes
from `NEXT_PUBLIC_CONTACT_EMAIL` and must be set before launch.
