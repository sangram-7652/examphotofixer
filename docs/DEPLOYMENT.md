# Deployment

## Target

Vercel (recommended) or any static-capable Node host. All routes are static; no server
runtime features, no env secrets.

## Environment variables

| Name                         | Required   | Description                                                                      |
| ---------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`       | production | Canonical origin, no trailing slash. Falls back to `https://examphotofixer.com`. |
| `NEXT_PUBLIC_SITE_INDEXABLE` | launch     | Exactly `true` to allow indexing. Leave unset on previews and until tools work.  |

See `.env.example`. Both are inlined at build time — rebuild after changing them.

## CI pipeline (recommended)

```
npm ci
npm run lint
npm run typecheck
npm run format:check
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

## Launch checklist

- [ ] CCC presets have official `source.url`, `document`, `version`, `verifiedOn`; status `verified`.
- [ ] Image pipeline implemented and all `it.todo` pipeline tests real and passing.
- [ ] Privacy and Terms reviewed.
- [ ] `NEXT_PUBLIC_SITE_URL` set; `NEXT_PUBLIC_SITE_INDEXABLE=true` on production only.
- [ ] Sitemap submitted to Google Search Console and Bing.
- [ ] Lighthouse mobile ≥ 90 on home and a tool page.
