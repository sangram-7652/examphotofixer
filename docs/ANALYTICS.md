# Analytics

Status (P9 + GA4): **event foundation implemented; an optional GA4 provider exists behind
`NEXT_PUBLIC_GA_MEASUREMENT_ID`.** Events are always produced in the browser and delivered to a
local DOM event (`epf:analytics`) that tests and local debugging listen to. With no measurement
ID configured (the default locally, in CI and in every existing test build), no analytics
script, SDK, cookie or network request exists — nothing has changed from before. With a real
measurement ID configured at build time, the same sanitized events are also sent to GA4 (see
"GA4 provider" below). **No real analytics data exists yet**; every number in tests and docs is
a fixture.

## API

`src/lib/analytics`:

| Export                              | Purpose                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `trackEvent(name, props)`           | The only way to send an event. Typed per event; never throws.                         |
| `setAnalyticsProvider(fn \| null)`  | Plug in a provider later (one function receiving `{ name, props }`).                  |
| `taxonomy.ts`                       | Event names and the allowlist of properties per event.                                |
| `sanitize.ts`                       | Drops unknown keys and unsafe values before anything is delivered.                    |
| `context.ts`                        | Route, page category, device class, browser family, referrer category, UTM whitelist. |
| `buckets.ts`                        | Coarse file-size and megapixel buckets.                                               |
| `reasons.ts`                        | Stable validation reason codes derived from the engine's report.                      |
| `tool-events.ts` (`trackJobResult`) | Maps a finished job to exactly one result event.                                      |
| `funnel.ts`                         | Conversion formulas.                                                                  |
| `providers/ga4.ts`                  | Optional GA4 (gtag.js) provider adapter; see "GA4 provider" below.                    |
| `components/AnalyticsRoot.tsx`      | `page_view`, landing acquisition, clicks on `data-analytics-event` links, GA4 wiring. |

Guarantees:

- **Safe no-op.** With no provider, nothing leaves the browser. A throwing provider, or a
  failing DOM dispatch, is swallowed; the tools keep working (e2e: "tools keep working end to
  end when analytics throws").
- **Kill switch.** `NEXT_PUBLIC_ANALYTICS_DISABLED=true` makes `trackEvent` a no-op, and also
  stops the GA4 script from ever loading (`resolveGa4MeasurementId()` returns `null`).
- **Not in the engine.** `src/lib/image` and `src/lib/validation` (the worker) never import
  analytics (unit test `boundaries.test.ts`). Events are sent from UI code only, after the fact,
  and never block processing.
- **No client components added to guides.** Guide and source-link clicks are handled by one
  delegated listener in the root layout, reading `data-analytics-*` attributes that server
  components render.
- **No SDK dependency.** `package.json` `dependencies` remain `next`, `react`, `react-dom`
  (unit test `boundaries.test.ts`); GA4 is loaded as a plain `<script>` tag (gtag.js), not an
  npm package.

## GA4 provider

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` (format `G-XXXXXXXXXX`, from the GA4 property's Data
Streams page) at build time to send events to Google Analytics 4. Unset, malformed, or
`NEXT_PUBLIC_ANALYTICS_DISABLED=true` → `resolveGa4MeasurementId()` returns `null`, the GA4
`<script>` is never inserted, `window.gtag` is never called, and nothing changes from the
no-provider behaviour above.

- **Cookieless by design.** `loadGa4` configures GA4 with `client_storage: "none"`, so it never
  sets `_ga`/`_ga_*` (or any other) cookie. This keeps the site's "no cookies" commitment
  (`docs/PRIVACY.md`) true whether or not GA4 is enabled, at the cost of GA4's own
  session/returning-visitor accuracy: without a persisted client ID, GA4 cannot reliably link
  two page loads to the same visitor, so session duration, "sessions per user" and similar GA4
  metrics undercount. Event counts and their properties are unaffected.
- **One central adapter.** `providers/ga4.ts`'s `GA4_EVENT_NAME` map sends every existing event
  name straight through to GA4 unchanged (no renaming to GA4's "recommended event" names); it's
  the one place a future divergence would be made, and it's exhaustive over
  `AnalyticsEventName` so a new taxonomy event missing from it is a type error.
- **Same sanitized payload.** GA4 receives exactly `event.props` as `sendToGa4` gets it from
  `setAnalyticsProvider` — already allowlisted and sanitized by `trackEvent`/`sanitizeProps`.
  Nothing is added back in; GA4 can only ever receive what any other provider would.
- **No duplicate `page_view`.** `loadGa4` sets `send_page_view: false` on GA4's `config` call,
  so GA4's own automatic page_view (sent on script load) never fires; the single `page_view`
  `AnalyticsRoot` already sends once per route is GA4's only source for it. In the GA4 Admin UI,
  leave the Enhanced Measurement "Page changes based on browser history events" toggle off for
  this reason — turning it on would make GA4 send a second page_view on client-side navigation.
  Enhanced Measurement's other automatic events (scroll, outbound click, file download, …) are
  unaffected and are not duplicated by anything this site sends itself.
- **Client-side only.** `AnalyticsRoot` is a client component; its GA4 effect only runs in the
  browser, and `loadGa4`/`sendToGa4` no-op (rather than throw) if called where `window` is
  undefined.
- **CSP.** `src/config/security-headers.ts` widens `script-src`/`connect-src` to GA4's origins
  (`GA4_SCRIPT_SRC`/`GA4_CONNECT_SRC`) only when `resolveGa4MeasurementId()` is non-null at
  build time (`next.config.ts`); with no measurement ID the CSP is unchanged (`'self' blob:'`
  for `connect-src`). `npm run smoke`'s security-header check and `security-headers.test.ts`
  accept only GA4's specific origins as additions, nothing broader.
- **Events sent to GA4.** The same sixteen events listed above, unchanged: `page_view`,
  `tool_viewed`, `exam_selected`, `image_selected`, `processing_started`,
  `processing_completed`, `processing_failed`, `validation_failed`, `result_ready`,
  `result_ready_with_warning`, `download_started`, `download_completed`,
  `pack_asset_completed`, `pack_completed`, `guide_tool_clicked`, `requirement_source_opened`,
  each with the same allowlisted properties (see "Properties" below). None carry file contents,
  file names, image data, EXIF/GPS or anything the user typed — see "Never collected".
- **Setup.** Create a GA4 property and a Web data stream, copy its Measurement ID into
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` for the production build only (same build-time rules as every
  other `NEXT_PUBLIC_*` value; see `docs/DEPLOYMENT.md`), and rebuild/redeploy.

## Event taxonomy

Sixteen events. Micro-events were deliberately not kept (see "Changes from P3–P8").

| Event                       | Purpose (question it answers)                                                        | Sent from                              |
| --------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| `page_view`                 | Which pages are visited; how people arrive (landing view only).                      | `AnalyticsRoot`, each route            |
| `tool_viewed`               | How many visits reach a working tool (funnel top). Once per tool, not per pack step. | `ImageTool`, `PackTool`, generic tools |
| `exam_selected`             | Which exams people look for on the home page, and where it sends them.               | `ExamSearch` chip click                |
| `image_selected`            | Do people get as far as choosing a file? Were files rejected, and why?               | All tools                              |
| `processing_started`        | A job began (result state `PROCESSING`).                                             | All tools                              |
| `processing_completed`      | A job produced output; carries its final `result_state` and output buckets.          | All tools                              |
| `processing_failed`         | Job ended in `ERROR` (engine error code).                                            | via `trackJobResult`                   |
| `validation_failed`         | Job ended in `INVALID` (reason code).                                                | via `trackJobResult`                   |
| `result_ready`              | Job ended in `READY`: every check passed.                                            | via `trackJobResult`                   |
| `result_ready_with_warning` | Job ended in `READY_WITH_WARNING` (e.g. below minimum KB); reason code.              | via `trackJobResult`                   |
| `download_started`          | User clicked download.                                                               | All tools, pack ZIP                    |
| `download_completed`        | File was handed to the browser (see "Download semantics").                           | All tools, pack ZIP                    |
| `pack_asset_completed`      | One Complete Pack file became usable (READY or READY_WITH_WARNING).                  | `PackTool`                             |
| `pack_completed`            | Every file in the pack is usable.                                                    | `PackTool`                             |
| `guide_tool_clicked`        | Do guides send readers to tools? Which guide → which tool.                           | `data-analytics-*` on guide CTAs       |
| `requirement_source_opened` | Do people check the official source? Reported by `source_id`, never URL.             | `data-analytics-*` on `SourceLink`     |

### Result states — one result event per job

| UI result state      | Event                       |
| -------------------- | --------------------------- |
| `PROCESSING`         | `processing_started`        |
| `READY`              | `result_ready`              |
| `READY_WITH_WARNING` | `result_ready_with_warning` |
| `INVALID`            | `validation_failed`         |
| `ERROR`              | `processing_failed`         |

`trackJobResult` sends exactly one of the four result events per finished job;
`processing_completed` accompanies every job that produced output (READY, READY_WITH_WARNING or
INVALID) and carries the same `result_state`. A job cancelled by a newer one (reset, new file)
sends no result event. Generic compressor outcomes map as `SUCCESS` → `READY` and
`LIMIT_NOT_REACHED` / `LARGER_THAN_ORIGINAL` / `INVALID` → `INVALID`. `READY` and
`READY_WITH_WARNING` are never merged.

### Properties

Every event automatically carries: `route` (pathname only, never the query), `page_category`
(`home`, `tools_index`, `tool`, `guides_index`, `guide`, `legal`, `other`), `device_class`
(`mobile` < 640 px ≤ `tablet` < 1024 px ≤ `desktop`, from viewport width) and `browser_family`
(`edge`, `samsung`, `firefox`, `chrome`, `safari`, `other`).

| Property                                            | Values                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tool_id`                                           | Registry ids: `ccc-photo`, `ccc-signature`, `ccc-thumb`, `ccc-pack`, `ibps-photo`, `image-resizer`, `image-compressor` |
| `tool_type`                                         | `preset`, `pack`, `generic-resize`, `generic-compress`                                                                 |
| `exam_id`                                           | `ccc`, `ibps` (never user text)                                                                                        |
| `asset_type`                                        | Preset `documentType` (`photo`, `signature`, `left-thumb`, …) or `pack`                                                |
| `result_state`                                      | `READY`, `READY_WITH_WARNING`, `INVALID`, `ERROR`                                                                      |
| `reason_code`                                       | See "Reason codes"                                                                                                     |
| `error_code`                                        | Engine `ProcessingErrorCode` (`unsupported-format`, `decode-failed`, …)                                                |
| `input_format`, `output_format`                     | `jpeg`, `png`, `webp`, … ; `zip` for the pack                                                                          |
| `input_size_bucket`, `output_size_bucket`           | `lt_20kb`, `20_50kb`, `50_200kb`, `200kb_1mb`, `1_5mb`, `5_10mb`, `gte_10mb`                                           |
| `input_megapixel_bucket`, `output_megapixel_bucket` | `lt_0.1mp`, `0.1_1mp`, `1_4mp`, `4_12mp`, `12_24mp`, `gte_24mp`                                                        |
| `accepted`                                          | `image_selected`: whether the file was accepted                                                                        |
| `asset_count`                                       | `pack_completed`: number of files                                                                                      |
| `referrer_category`                                 | `page_view` (landing only): `direct`, `organic_search`, `social`, `referral`, `other`                                  |
| `utm_source`, `utm_medium`, `utm_campaign`          | `page_view` (landing only): lower-cased, `[a-z0-9_.-]{1,40}`, else dropped                                             |
| `destination_tool_id`, `source_page_category`       | `exam_selected`, `guide_tool_clicked`                                                                                  |
| `guide_id`, `source_id`                             | Guide slug; `RequirementSource.id` (e.g. `nielit-ccc-guidelines-v1.11`)                                                |

Values must match `^[A-Za-z0-9_\-./]{1,64}$` and must not contain `blob:`, `data:`, `base64`,
`http(s):` or `@`; numbers must be finite and bounded. Anything else is dropped silently.

### Never collected

Image bytes, binary or base64; image, blob or data URLs; file names; original EXIF, GPS
coordinates, camera make/model, EXIF timestamps; image hashes or fingerprints; exact
dimensions or byte counts of the user's file (buckets only); anything the user types (exam
search text, custom sizes); email, phone or other personal data; IP address as an event
property; full URLs, full referrers or query strings (only the whitelisted UTM keys).
Enforced by the allowlist + sanitizer (unit tests) and by e2e tests that upload a JPEG with
GPS, camera and timestamp EXIF under a filename containing a name, phone number and email.

### Reason codes

Derived in `reasons.ts` from the engine's `ValidationReport`, its compression status and output
facts; they never re-decide pass/fail. The primary (first failed check) is sent.

| Code                               | Engine behaviour                                           |
| ---------------------------------- | ---------------------------------------------------------- |
| `DIMENSIONS_MISMATCH`              | `dimensions` check failed                                  |
| `ASPECT_RATIO_MISMATCH`            | `aspect-ratio` check failed                                |
| `FORMAT_MISMATCH`                  | `format` check failed                                      |
| `FILE_TOO_SMALL`                   | `file-size` failed with compression status `below_minimum` |
| `FILE_TOO_LARGE`                   | `file-size` failed with compression status `above_maximum` |
| `FILE_SIZE_OUT_OF_RANGE`           | `file-size` failed with any other status                   |
| `DPI_MISSING` / `DPI_OUT_OF_RANGE` | `dpi` failed; output has no DPI / DPI outside the range    |
| `METADATA_PRESENT`                 | `metadata` check failed                                    |
| `PROCESSING_FAILED`                | `processing` check failed                                  |
| `COMPRESSION_LIMIT_NOT_REACHED`    | Compressor outcome `LIMIT_NOT_REACHED`                     |
| `OUTPUT_LARGER_THAN_ORIGINAL`      | Compressor outcome `LARGER_THAN_ORIGINAL`                  |

File rejections before processing reuse the engine's `ProcessingErrorCode` as `error_code` on
`image_selected` (plus `unreadable` when the browser can't decode the file).

## Download semantics

`download_started` fires on the download click. `download_completed` fires right after the
file is handed to the browser (the `download` link's default action, or the ZIP link for the
pack). **Browsers do not report whether a file was actually saved**, so `download_completed`
means "hand-off", not "saved to disk"; cancelled save dialogs are counted too. The two events
are kept separate so a future provider can drop duplicates or detect aborted hand-offs.

## Conversion formulas (`funnel.ts`)

All rates are `null` (not 0) when the denominator is 0. They count events, not people.

| Rate                         | Formula                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `tool_select_rate`           | `image_selected ÷ tool_viewed`                                        |
| `processing_completion_rate` | `processing_completed ÷ processing_started`                           |
| `download_rate`              | `download_completed ÷ processing_completed`                           |
| `successful_download_rate`   | `download_completed (result_state = READY) ÷ result_ready`            |
| `warning_download_rate`      | `download_completed (READY_WITH_WARNING) ÷ result_ready_with_warning` |
| `ready_rate`                 | `result_ready ÷ processing_started`                                   |
| `warning_rate`               | `result_ready_with_warning ÷ processing_started`                      |
| `invalid_rate`, `error_rate` | `validation_failed` / `processing_failed ÷ processing_started`        |

`processing_completed` counts jobs that produced output, including `INVALID` ones (which can't
be downloaded), so `download_rate` is the broad rate; `successful_download_rate` and
`warning_download_rate` keep READY and READY_WITH_WARNING apart and are the ones to compare.
No values exist for any of these yet: they are definitions, not measurements.

`image_selected` includes rejected files; filter `accepted = true` for the select → process
step. Retries (reprocessing after "Adjust crop") are separate jobs. For the Complete Pack, use
`pack_asset_completed` per `asset_type` and `pack_completed ÷ tool_viewed (tool_id = ccc-pack)`.

## Acquisition and consent

The landing `page_view` carries `referrer_category` (categorised by referrer host; the URL
itself is discarded) and at most `utm_source`, `utm_medium`, `utm_campaign`. Other query
parameters, including search terms, are never read. Later page views in the same visit carry
no acquisition data.

No cookies, local storage or identifiers are used by analytics (GA4 is deliberately configured
cookieless; see "GA4 provider" above), so no consent banner is needed today. The core tools
never depend on analytics or consent. **Before adding another provider:** prefer a cookieless
one; send only the sanitized `{ name, props }`; update `/privacy`, `docs/PRIVACY.md` and this
file in the same change; add its origin to the CSP `connect-src` in
`src/config/security-headers.ts` (today `'self' blob:'`, plus GA4's origins only when GA4 is
enabled, so the browser blocks any other provider until its origin is added); add consent
handling if it sets cookies or identifiers.

## Adding another provider

GA4 (above) is the first implemented provider; the same pattern applies to a second one:

1. Choose a cookieless provider if possible; check its data residency and whether it needs
   consent. Do not add a paid SDK or a script tag on tool pages without review (CLAUDE.md).
2. Register one function, client-side only, e.g. in `AnalyticsRoot`:
   `setAnalyticsProvider((event) => navigator.sendBeacon(ENDPOINT, JSON.stringify(event)))`.
   Send only `event` (already sanitized); never add identifiers, the URL or the referrer. Only
   one provider function is registered at a time — adding a second means combining both inside
   one function passed to `setAnalyticsProvider`.
3. Add the endpoint's origin to `connect-src` (and `script-src` if it loads a script) in
   `src/config/security-headers.ts`, gated the same way GA4's origins are (behind a build-time
   "is this provider configured" check, never unconditionally), and update the unit and smoke
   checks. Update `/privacy`, `docs/PRIVACY.md` and this file in the same change; add consent
   handling if it sets cookies or identifiers.
4. Extend `e2e/analytics.spec.ts` to intercept the endpoint and run the same payload checks.

**Disabling:** set `NEXT_PUBLIC_ANALYTICS_DISABLED=true` at build time; `trackEvent` then
returns before building any event, and GA4's script never loads either
(`resolveGa4MeasurementId()` returns `null`). Tools are unaffected.

## Known limitations

- Events count actions, not people or sessions: there are no identifiers by design.
- `download_completed` is the hand-off to the browser, not a confirmed save (see above).
- `device_class` is derived from viewport width and `browser_family` from the user agent;
  both are approximate (e.g. desktop "request mobile site", UA reduction).
- `referrer_category` depends on the browser's referrer policy; search engines send only the
  origin, so organic landings are categorised but queries are never known on-site.
- Content blockers, disabled JavaScript or a future consent choice will make event counts
  lower than Search Console clicks for the same page.
- Tab closes during processing produce `processing_started` with no result event.

## Changes from P3–P8

`track()` became `trackEvent()` with typed, allowlisted props.

| Old                                                                                                                     | New                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `tool_open`, `pack_open`                                                                                                | `tool_viewed` (once per page; embedded pack steps don't send it)           |
| `validation_passed` / `validation_warning` / `validation_failed`                                                        | `result_ready` / `result_ready_with_warning` / `validation_failed`         |
| `processing_completed { ok: false }`                                                                                    | `processing_failed`                                                        |
| `download_clicked`, `pack_download_clicked`                                                                             | `download_started`                                                         |
| `pack_download_completed`                                                                                               | `download_completed` (`asset_type: pack`, `output_format: zip`)            |
| `crop_started`, `crop_completed`, `tool_reset`, `pack_reset`, `resize_settings_changed`, `compression_settings_changed` | Removed (micro-events)                                                     |
| `preset_id`, `size_bucket`, `duration_ms`, `quality`, `zoom`, `checks`                                                  | Removed or replaced by `asset_type`, size/megapixel buckets, `reason_code` |

## Offline report (P11)

`npm run analytics:report -- <events.ndjson> [--min-sample 100]` reads an exported event
stream (one sanitized `{ "name", "props" }` per line, as a provider receives it) and prints the
funnel per tool, problem discovery (reason/error codes) and per-route engagement
(`src/lib/analytics/report.ts`). `image_selected` counts accepted files only; rejected files
appear under problem discovery. Any rate whose denominator is below the minimum sample is
printed as "insufficient". Keep real exports in `data/` (git-ignored). A fake sample for tests
is `fixtures/analytics/FAKE-events-sample.ndjson`. No provider exists, so no real export exists.

## Search data

Search Console analysis is offline and separate: see `SEARCH_DATA_ANALYSIS.md`.
