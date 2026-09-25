# Google Search Console

No credentials or verification tokens are stored in this repository.

## 1. Verify the property

Preferred: a **Domain property** (covers `https://`, `http://`, `www` and subdomains).

1. Search Console → Add property → Domain → enter `examphotofixer.com`.
2. Add the TXT record Google shows to the domain's DNS (at the DNS provider, not in git).
3. Click Verify (DNS can take a while to propagate).

Alternative: **URL-prefix property** with the HTML-tag method. Set the token as an environment
variable in the hosting provider — never commit it:

```
GOOGLE_SITE_VERIFICATION=<token from Search Console>
```

The root layout renders `<meta name="google-site-verification">` only when this variable is set
at build time. Rebuild/redeploy after setting it.

Before verifying, production must have `NEXT_PUBLIC_SITE_URL=https://examphotofixer.com` and
`NEXT_PUBLIC_SITE_INDEXABLE=true`; otherwise robots.txt disallows everything and pages are noindex.

## 2. Submit the sitemap

Search Console → Sitemaps → enter `sitemap.xml` → Submit. It lists the live tools, `/tools`,
`/guides`, published guides, `/privacy` and `/terms` (see `src/lib/seo/routes.ts`). Placeholder
tools, redirects and `/dev/*` are excluded. robots.txt also points to the sitemap.

## 3. Inspect a URL

Top search bar → paste a full URL (e.g. `https://examphotofixer.com/ccc-photo-resizer`).
Check: "URL is on Google", the **user-declared canonical** equals the page URL, the
**Google-selected canonical** agrees, and "Crawl allowed / Indexing allowed" are Yes.
Use **Test live URL** → View tested page → HTML to confirm the server-rendered content.

## 4. Request indexing

After a meaningful change or for a new page: URL Inspection → **Request indexing**. Use it
sparingly (quota per day); the sitemap covers routine discovery.

## 5. What to monitor

| Metric                         | Where                        | Why                                    |
| ------------------------------ | ---------------------------- | -------------------------------------- |
| Impressions                    | Performance → Search results | Visibility                             |
| Clicks                         | same                         | Traffic from search                    |
| CTR                            | same                         | Title/description effectiveness        |
| Average position               | same                         | Ranking trend (an average, not a rank) |
| Indexed pages                  | Indexing → Pages             | Should match the sitemap's live URLs   |
| Excluded pages ("Not indexed") | Indexing → Pages             | Find unexpected exclusions             |
| Core Web Vitals                | Experience → Core Web Vitals | LCP, INP, CLS from real Chrome users   |

Tool usage comes from the provider-independent analytics events (`tool_viewed`,
`image_selected`, `processing_started`, `result_ready`, `result_ready_with_warning`,
`validation_failed`, `processing_failed`, `download_started`, `download_completed`; see
`ANALYTICS.md`). They count events, not unique people. No provider is installed yet, so no
event data exists. To analyse exported Search Console data offline (top queries, low-CTR
queries, pages, query + page, device, country, date), see `SEARCH_DATA_ANALYSIS.md`.

## 6. Inspect search queries

Performance → Search results → **Queries** tab. Add a **Page** filter to see which queries lead
to one page, or click a query and open the **Pages** tab to see where it lands.

## 7. Pages with impressions but low CTR

Performance → enable Impressions, Clicks, CTR, Position → **Pages** tab → sort by Impressions.
Look for pages with many impressions and CTR well below similar pages at a similar position.
Improve the title/description to answer the query more directly — don't add keywords.

## 8. Queries where the site ranks but gets few clicks

Queries tab → filter **Position** smaller than 10 → sort by Impressions → look for low CTR.
Check whether the page actually answers that query; if a guide or tool already does, make the
answer clearer near the top. If the intent is genuinely different, consider (rarely) new content.

## 9. Indexing problems

Indexing → Pages → **Why pages aren't indexed**. Common reasons and what to check:

- _Excluded by 'noindex' tag_: expected only for placeholders, `/dev/*` and 404s.
- _Alternate page with proper canonical tag_: fine if it's a redirect/duplicate.
- _Page with redirect_: `/ccc-image-resizer` → `/ccc-complete-pack` (intended).
- _Not found (404)_: follow the referring URL; there should be no internal links to 404s
  (the e2e SEO crawl checks this).
- _Crawled/Discovered – currently not indexed_: usually content quality or time.

## 10. Core Web Vitals

Experience → Core Web Vitals (mobile and desktop). Field data needs enough traffic; until then
use PageSpeed Insights / Lighthouse for lab data. Watch LCP (hero text), CLS (no layout shifts
from images) and INP (tool interactions — heavy work runs in the Web Worker).
