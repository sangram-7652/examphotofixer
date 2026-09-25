# Production launch checklist

State at P10 (2026-09-25): **A. code ready — yes. B. deployment configured — no. C. live
production verified — no.** A box is ticked only when the repository itself proves it (tests,
build output). Everything that needs the real domain, hosting account or an owner decision is
open. Details: `DEPLOYMENT.md`.

## Launch blockers (owner)

- [ ] Legal review of `/privacy` and `/terms` (both are drafts; the page source says so).
- [ ] Public contact address: set `NEXT_PUBLIC_CONTACT_EMAIL` on production (until then
      `/privacy` says an address will be published).
- [ ] Hosting project created and linked; domain added; DNS records created.
- [ ] Production environment: `NEXT_PUBLIC_SITE_URL=https://examphotofixer.com`,
      `NEXT_PUBLIC_SITE_INDEXABLE=true` (production only), `NEXT_PUBLIC_CONTACT_EMAIL`.

## DOMAIN

- [ ] Canonical domain configured (`examphotofixer.com`, apex)
- [ ] HTTPS working (certificate issued, HSTS header served)
- [ ] Redirects working: `http://` → `https://`, `www` → apex, one hop each
      (`npm run smoke -- https://examphotofixer.com --host-checks`)
- [x] App-level www → apex safety net and trailing-slash 308s (unit + e2e)

## SEO

- [x] robots allows crawling in launch builds; `/dev/` disallowed; sitemap on the canonical
      origin; pre-launch builds disallow everything (unit, e2e in both modes, smoke CLI)
- [x] Sitemap correct: 17 HTTPS URLs on the canonical host, no localhost/dev/query/duplicate,
      every URL 200 without redirect and self-canonical (e2e + smoke CLI on a launch build)
- [x] Canonical and Open Graph URLs use the canonical HTTPS origin (e2e, smoke CLI)
- [x] Metadata correct: title, description, one H1, JSON-LD matching visible content (e2e)
- [x] No accidental noindex in launch builds (smoke CLI + `E2E_LAUNCH=1` run)
- [ ] Same checks against the live domain after deploy (`npm run smoke`)

## PRIVACY

- [x] No image upload: no non-GET and no cross-origin requests while selecting, processing,
      validating and downloading (e2e, JPEG with GPS/camera/timestamp EXIF, all browsers)
- [x] No EXIF/GPS or file names in any request or analytics payload (e2e)
- [x] Browser-enforced: CSP `connect-src 'self' blob:` (a cross-origin POST was blocked on all four browsers)
- [x] Analytics privacy verified; no provider installed; no cookies set (e2e)
- [x] Privacy page states only implemented behaviour (e2e checks key statements)
- [ ] Privacy page legally reviewed, with a contact address
- [ ] Terms ready (legal review)
- [ ] Manual check on the live site: DevTools → Network while processing on a real phone

## SECURITY

- [x] Security headers: CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy,
      X-Frame-Options; no `X-Powered-By` (unit, e2e, smoke CLI)
- [x] No secrets in the repository (V1 has none; `.env*` ignored except `.env.example`)
- [x] Environment variables documented (public vs server-only vs test-only)
- [x] Dependency audit: `npm audit` 0 vulnerabilities (2026-09-25); no dependency added
- [ ] Production environment variables set in the hosting project; `ENGINE_HARNESS` not set
      (smoke CLI fails if `/dev/image-engine` is served)

## QUALITY

- [x] Production build
- [x] E2E on Chromium, Firefox, WebKit and Pixel 7 (see the P10 commit for counts)
- [x] Mobile layout, no horizontal overflow, touch targets ≥ 44 px (e2e)
- [x] Accessibility: axe WCAG 2.2 A/AA 0 violations on all pages and tool states; keyboard-only
      flow (e2e). Manual screen-reader pass: not done
- [x] Downloads: bytes re-validated after download; ZIP entries equal individual files (e2e)
- [x] 404s and redirects (e2e)
- [ ] Lighthouse / field Core Web Vitals on the live site (lab numbers only so far)

## OPERATIONS

- [x] Deployment documented (`DEPLOYMENT.md`)
- [x] Rollback documented
- [x] Monitoring strategy documented (smoke CLI after deploy + uptime monitor; no provider)
- [x] Recovery and backup documented (no database; Git + env + DNS)
- [ ] Uptime monitor created for `/` and `/robots.txt`
- [ ] CI runs `npm run check`, build and e2e with `npx playwright install --with-deps`

## SEARCH CONSOLE (after the live smoke test passes)

Follow `SEO_SEARCH_CONSOLE.md`. Don't claim indexing until Search Console shows it.

- [ ] Property verified (Domain property via DNS TXT preferred)
- [ ] Sitemap submitted (`sitemap.xml`)
- [ ] Key URLs inspected (live test): `/`, `/tools`, `/guides`, `/ccc-photo-resizer`,
      `/ccc-complete-pack`, `/ibps-photo-resizer`, `/image-resizer`, `/image-compressor`,
      `/guides/ccc-photo-size`, `/guides/ibps-photo-size`
- [ ] Indexing requested only for `/` and the main tool pages; the sitemap covers the rest
- [ ] Indexing status monitored (Indexing → Pages) for the first weeks
