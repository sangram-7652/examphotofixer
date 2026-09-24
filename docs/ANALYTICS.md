# Analytics

Status: **hooks implemented, no provider.** `src/lib/analytics` exposes `track(name, props)`.
Events go to an optional provider (`setAnalyticsProvider`) and are dispatched as a DOM
`epf:analytics` event (used by e2e tests). No analytics script is loaded.

## Principles

- Privacy-friendly, cookieless analytics only (e.g. Vercel Web Analytics or Plausible). Decide before launch.
- **Never** send file contents, file names, image dimensions of the user's original photo,
  EXIF data or anything derived from image content.
- No personal data; no cross-site tracking; no advertising pixels.

## Events (implemented in `ImageTool`)

All events carry `tool_id` and `preset_id`.

| Event                  | Extra properties                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `tool_open`            | —                                                                                          |
| `image_selected`       | `accepted`, `input_format`, `size_bucket` (`<1MB`, `1-5MB`, `5-10MB`, `>10MB`) or `reason` |
| `crop_started`         | —                                                                                          |
| `crop_completed`       | `zoom`                                                                                     |
| `processing_started`   | —                                                                                          |
| `processing_completed` | `ok`, `duration_ms`, `quality` or `error_code`                                             |
| `validation_passed`    | —                                                                                          |
| `validation_warning`   | `status` (e.g. `below_minimum`)                                                            |
| `validation_failed`    | `checks` (failed check ids)                                                                |
| `download_clicked`     | `state`                                                                                    |
| `download_completed`   | — (browsers don't report save completion; fired right after hand-off)                      |
| `tool_reset`           | —                                                                                          |

Event names and allowed properties will live in one typed module (`src/lib/analytics/`) so
nothing else can send ad-hoc data.

## Guides (P7)

No guide event was added: guides are server-rendered without page JavaScript, and a page view
from the analytics provider covers "guide opened". Search Console metrics are described in
`SEO_SEARCH_CONSOLE.md`.
