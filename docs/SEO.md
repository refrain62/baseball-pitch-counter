# SEO checklist

## Implemented

- Descriptive Japanese title and meta description for `/` and `/counter/`.
- Natural on-page wording for 野球 / ベースボール / 投球数 / カウンター / ピッチカウンター.
- Canonical URLs, Open Graph, Twitter cards, robots directives.
- Semantic H1/H2 content and a useful use-case section for baseball pitch-count search intent.
- JSON-LD `WebSite` + `WebApplication` structured data without fabricated ratings/reviews.
- `robots.txt` allows crawling and points to `sitemap.xml`.
- `sitemap.xml` includes LP and counter URLs with last-modified dates.
- Descriptive image alt text where images convey meaning; decorative images remain empty-alt.

## After deployment

1. Add the site to Google Search Console.
2. Submit `https://baseball-pitch-counter.refrain62.workers.dev/sitemap.xml`.
3. Use URL Inspection for `/` and `/counter/`, then request indexing.
4. Run Google Rich Results Test / Schema Markup Validator to confirm JSON-LD syntax.
5. Monitor Search Console queries for phrases such as `野球 投球数 カウンター`, `投球数カウンター`, `野球 カウンター`, and improve page copy based on real impressions/clicks.

## Note

Google does not use the old `meta keywords` tag for ranking. Keywords are therefore placed naturally in the title, description, headings, and useful page content instead of adding a keyword-stuffed tag.


## v33 follow-up

- Added visible FAQ content for long-tail search intent and matching FAQPage JSON-LD.
- Added `og:image:width` / `og:image:height`.
- Added LP `apple-touch-icon`.
- Prioritized the hero visual with `fetchpriority="high"`.
- Lazy-loaded below-the-fold QR images.
- Separated `/counter/` title/description from the LP to match search intent.
