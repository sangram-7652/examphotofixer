# Analytics

Status: **not implemented.** No analytics script is loaded in V1 foundation.

## Principles

- Privacy-friendly, cookieless analytics only (e.g. Vercel Web Analytics or Plausible). Decide before launch.
- **Never** send file contents, file names, image dimensions of the user's original photo,
  EXIF data or anything derived from image content.
- No personal data; no cross-site tracking; no advertising pixels.

## Planned events

| Event               | Properties                                                              | Purpose                            |
| ------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `tool_view`         | `tool_id`                                                               | Funnel start (page view is enough) |
| `file_selected`     | `tool_id`, `input_format`, `size_bucket` (e.g. `<1MB`, `1–5MB`, `>5MB`) | Input mix                          |
| `processing_failed` | `tool_id`, `error_code`                                                 | Fix pipeline issues                |
| `validation_failed` | `tool_id`, `check_id`                                                   | Which requirements users miss      |
| `download`          | `tool_id`, `preset_id`, `quality_bucket`                                | Success metric                     |

Event names and allowed properties will live in one typed module (`src/lib/analytics/`) so
nothing else can send ad-hoc data.
