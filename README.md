# ExamPhotoFixer

**Fix it before you upload.** — Exam & Application File Tools.

Browser-based tools that prepare photos, signatures and thumb impressions for Indian online
exam and application forms. Files are processed locally and never uploaded.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                    | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `dev` / `build` / `start` | Next.js                                                                |
| `lint`                    | ESLint                                                                 |
| `typecheck`               | Route type generation + `tsc --noEmit`                                 |
| `test` / `test:watch`     | Vitest unit tests                                                      |
| `test:e2e`                | Playwright (run `build` first; `npx playwright install chromium` once) |
| `format` / `format:check` | Prettier                                                               |
| `check`                   | lint + typecheck + format check + unit tests                           |
| `smoke -- <url>`          | Launch / post-deploy gate on a running site (see docs/DEPLOYMENT.md)   |
| `search:report -- <csv>`  | Offline Search Console export report (docs/SEARCH_DATA_ANALYSIS.md)    |

## Documentation

Start with [CLAUDE.md](CLAUDE.md) and [docs/](docs/): PRD, architecture, image processing,
validation, presets, SEO, analytics, testing, privacy, deployment, roadmap.
