# Deployment

Status (P10): **code ready; not deployed.** No hosting project, domain, DNS or Search Console
property has been configured from this repository, and no live URL has been verified. Every
"live" step below is a manual step for the owner. Launch blockers: `PRODUCTION_LAUNCH_CHECKLIST.md`.

## Architecture

```
User → DNS → CDN / HTTPS (hosting platform) → Next.js (prerendered pages + static assets)
     → browser: image engine in a Web Worker → download (blob: URL)
```

- Every public route is prerendered at build time (`○`/`●` in `next build` output). There are no
  API routes, no database, no server-side image processing, no uploads and no secrets.
- The image never leaves the browser. The CSP (`connect-src 'self' blob:`) makes the browser refuse
  to send data to any other origin; `e2e` asserts no non-GET requests and no cross-origin
  requests while processing.
- `/dev/image-engine` (test harness) returns 404 unless the server runs with `ENGINE_HARNESS=1`.
- Do not add Docker, a database, Redis, queues, object storage or an image server for V1.

## Platform

The repository has always documented **Vercel** as the recommended target (zero-config Next.js,
HTTPS, CDN, instant rollback); the project is not linked yet (no `.vercel/`). Any host that runs
`next start` on Node ≥ 22 behind HTTPS also works. No platform-specific code or dependency is
used: headers and redirects live in `next.config.ts`.

## Prerequisites

- Node ≥ 22 (CI/dev use Node 24), npm, the Git repository.
- Owner decisions and access: the domain (`examphotofixer.com` is the configured canonical
  host), DNS access, a hosting account, a public contact address for `/privacy`, legal review
  of `/privacy` and `/terms`.

## Environment variables

All are build-time: **rebuild/redeploy after changing any of them.** There are no secrets.
`NEXT_PUBLIC_*` values are visible in client JavaScript and must never hold credentials.

| Name                             | Scope       | Production                   | Preview / local | Default if unset             |
| -------------------------------- | ----------- | ---------------------------- | --------------- | ---------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | public      | `https://examphotofixer.com` | same            | `https://examphotofixer.com` |
| `NEXT_PUBLIC_SITE_INDEXABLE`     | public      | `true`                       | **unset**       | not indexable                |
| `NEXT_PUBLIC_CONTACT_EMAIL`      | public      | owner's contact address      | optional        | no address shown             |
| `NEXT_PUBLIC_ANALYTICS_DISABLED` | public      | unset (no provider anyway)   | unset           | events enabled locally       |
| `GOOGLE_SITE_VERIFICATION`       | server-only | only for HTML-tag method     | unset           | no meta tag                  |
| `ENGINE_HARNESS`                 | test-only   | **never**                    | e2e only        | harness 404                  |

On Vercel, set `NEXT_PUBLIC_SITE_INDEXABLE=true` for the **Production** environment only, so
preview deployments stay `noindex` and `Disallow: /`. Keep `NEXT_PUBLIC_SITE_URL` the canonical
origin everywhere: previews then declare the production canonical and are not indexed.

## Build and deploy

```
npm ci
npm run check          # lint + typecheck + format + unit tests
npm run build
npm run test:e2e       # needs browsers: npx playwright install --with-deps
```

- **Vercel (Git integration):** import the repository, framework "Next.js", build command
  `npm run build`, install `npm ci`, Node 24. Set the variables above. Pushing to `main`
  deploys production; other branches get preview URLs.
- **Vercel CLI:** `vercel link`, `vercel env add …`, `vercel deploy` (preview), `vercel deploy --prod`.
- **Other Node host:** `npm ci && npm run build && npm run start -- --port $PORT` behind an
  HTTPS reverse proxy that passes the `Host` header; serve HTTP → HTTPS redirects at the proxy.

## Domain, DNS and HTTPS

Canonical origin: **`https://examphotofixer.com`** (apex, no `www`, no trailing slash).

1. Add `examphotofixer.com` and `www.examphotofixer.com` to the hosting project.
2. At the DNS provider, create exactly the records the hosting platform's Domains page shows
   (typically an `A` record for the apex and a `CNAME` for `www`). Don't copy record values from
   blogs or old docs; platforms change them.
3. In the platform, set `www.examphotofixer.com` to **redirect (308) to**
   `examphotofixer.com`. `next.config.ts` also redirects `www` → apex in one hop as a safety
   net (`alternateHostRedirect`).
4. HTTPS certificates are issued by the platform once DNS resolves. HTTP → HTTPS is done by the
   platform. The app sends `Strict-Transport-Security: max-age=31536000` (no `includeSubDomains`
   or `preload`: those affect every subdomain and are hard to undo; add them deliberately later).
5. Trailing slashes: Next.js redirects `/path/` → `/path` (308). Canonicals and the sitemap
   never use trailing slashes.

Verify with `npm run smoke -- https://examphotofixer.com --host-checks` (below). It fails on any
redirect chain (e.g. `http://www` → `https://www` → apex) — fix those at the platform/DNS level.

### Cloudflare (optional; not selected)

If Cloudflare is used for DNS in front of Vercel, prefer **DNS only** (grey cloud), as Vercel
recommends, so Vercel terminates HTTPS and handles redirects. If the proxy is enabled: SSL/TLS
mode **Full (strict)**; "Always Use HTTPS" on; and turn **off** anything that rewrites HTML or
injects scripts (Rocket Loader, Email Address Obfuscation, Zaraz, "Web Analytics"
auto-injection): injected scripts violate the CSP and can break
hydration or the image worker. Don't cache HTML longer than the platform does. No Cloudflare
code or dependency is needed in the app.

## Security headers

Set for every route in `next.config.ts` from `src/config/security-headers.ts`:
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone,
geolocation, payment, usb off) and `X-Frame-Options: DENY`; `X-Powered-By` is removed.

CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:; font-src 'self'; connect-src 'self' blob:; worker-src 'self';
manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.

- `'unsafe-inline'` for scripts is required because pages are prerendered: Next.js inline
  hydration scripts need either this or per-request nonces, and nonces force every page to be
  rendered dynamically (no static HTML, no CDN caching). Next's hash-based SRI is experimental.
  The directives that protect users' files (`connect-src`, `worker-src`, `form-action`,
  `object-src`, `frame-ancestors`) are strict. No `unsafe-eval` in production; no wildcards.
- Verified by `e2e/launch.spec.ts` on Chromium, Firefox, WebKit and mobile: preset and generic
  tools process, preview (blob:) and download with zero CSP violations; a deliberate
  cross-origin `fetch` from a tool page was confirmed blocked and reported on all four (P10 audit).
- Adding any third-party origin (analytics, monitoring) means editing `connect-src`/`script-src`
  there, updating the unit and smoke checks, `/privacy` and `docs/PRIVACY.md`.

## robots.txt and sitemap

- Production (`NEXT_PUBLIC_SITE_INDEXABLE=true`): `User-Agent: *`, `Allow: /`,
  `Disallow: /dev/`, `Sitemap: https://examphotofixer.com/sitemap.xml`.
- Anything else: `Disallow: /` and `noindex` on every page.
- The sitemap lists only live tools, `/`, `/tools`, `/guides`, published guides, `/privacy`
  and `/terms`, on the canonical HTTPS origin (17 URLs at P10). Placeholder tools, redirects
  and `/dev/*` are excluded.
- Gates: unit tests (`robots.test.ts`, `smoke.test.ts`), `e2e/seo.spec.ts`,
  `e2e/launch.spec.ts` (pre-launch and `E2E_LAUNCH=1`), and `npm run smoke` after deploy.

## Post-deploy smoke test (health check)

There is no `/health` endpoint: the site is prerendered, so availability of `/` with the right
headers is the health signal, and an endpoint would add a server route for nothing. After every
production deploy:

```
npm run smoke -- https://examphotofixer.com --host-checks
```

It issues GET requests only (never uploads or processes images) and checks: home 200; security
headers with `connect-src 'self' blob:`; robots rules; sitemap URLs (HTTPS, canonical host, no
localhost/dev/query/duplicates); every sitemap page 200 without redirect, self-canonical and
indexable; a real 404; `/dev/image-engine` is 404; HTTP → HTTPS and www → apex in one hop.
Exit code 0 means all passed. For a preview URL use
`npm run smoke -- <preview-url> --origin https://examphotofixer.com --prelaunch`.

Then check by hand once: process a photo on `/ccc-photo-resizer` on a real phone, download
it, and confirm in DevTools → Network that no request carries the file.

## Monitoring

No monitoring or error-reporting provider is configured, and none was added in P10.

- **Availability:** point a free uptime monitor (any provider) at `https://examphotofixer.com/`
  and `/robots.txt`; alert on non-200. Run `npm run smoke` after each deploy.
- **Platform:** Vercel's built-in deployment and runtime logs cover build failures and
  server errors (static pages rarely produce any).
- **Client errors:** not collected. If an error-monitoring service is added later it must scrub
  URLs and query strings, never attach file names, image data, EXIF/GPS or user input, must not
  run in the image worker, and its origin must be added to the CSP deliberately.
- **Search:** Search Console (`SEO_SEARCH_CONSOLE.md`) once the domain is verified.

## Rollback and recovery

- **Rollback (Vercel):** Deployments → pick the last good production deployment → "Instant
  Rollback" (or `vercel rollback`). Nothing to migrate: there is no database or stored state.
- **Rollback (Git):** `git revert <bad-commit>` on `main` and push; the platform redeploys.
- **Redeploy from scratch:** clone the repository → create a hosting project → set the
  environment variables from the table above → deploy `main` → re-add the domains and DNS
  records → run the smoke test.
- **If robots/indexing goes wrong** (e.g. a preview was indexed or production shows noindex):
  fix `NEXT_PUBLIC_SITE_INDEXABLE` for the right environment, redeploy, run the smoke test,
  then use Search Console URL inspection. For an accidental exposure, Search Console →
  Removals.

## Backup

There is no application database and no user data to back up. What matters:

| What                                                        | Where it lives                                 | Backup                                           |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Code, presets + source verification metadata, content, docs | Git (`src/lib/presets`, `src/content`, `docs`) | Remote Git host + at least one clone             |
| Environment variable names and values                       | Hosting project settings                       | Names in this file; values in a password manager |
| Domain, DNS records, redirects                              | Registrar / DNS provider / host                | Export or screenshot records after changes       |
| Search Console property, verification method                | Google account                                 | Owner account access; DNS TXT record             |

## Launch audit results (P10, local lab, not field data)

Environment: Linux, production build served by `next start` on localhost, Playwright
Chromium. Lab measurements vary by machine and are **not** Core Web Vitals field data; field
data comes from Search Console / CrUX after launch.

- **First-load JavaScript (gzip, from build output):** content pages (home, `/tools`,
  `/guides`, guides, `/privacy`) ≈ 173 KB, almost all shared React/Next.js runtime; tool pages
  ≈ 197 KB. The image engine and worker load only when a tool is used. Fonts are self-hosted.
- **Page load, Pixel 7 emulation, cold cache, 1.6 Mbps download, 4× CPU throttle:** FCP/LCP
  ≈ 0.80–0.86 s and CLS 0.000 on `/`, a guide, `/ccc-photo-resizer`, `/ccc-complete-pack` and
  `/image-compressor`; load event ≈ 1.7–1.8 s. (Latency emulation did not apply to the
  localhost document request, so TTFB was not measured meaningfully.)
- **Client-side processing** (desktop CPU, unthrottled, Chromium, CCC photo): 12 MP ≈ 0.9 s;
  48 MP (6000 × 8000, decoded at reduced size) ≈ 0.9 s. UI-thread responsiveness for 12 MP and
  48 MP is asserted in `e2e/image-engine.spec.ts` (Firefox 48 MP is a known limitation).
- **Accessibility:** axe-core 4.13 (WCAG 2.0/2.1/2.2 A and AA rules) on 15 pages and 6 tool
  states (crop, READY, READY_WITH_WARNING, rejected file, compressor settings,
  LIMIT_NOT_REACHED), desktop and Pixel 7: 0 violations. Keyboard-only flow in
  `e2e/accessibility.spec.ts`. Manual screen-reader testing has not been done.
