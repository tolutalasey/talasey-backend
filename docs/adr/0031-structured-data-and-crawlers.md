title: '0031 Structured data, sitemaps, crawler rules, IndexNow and llms.txt',
};

# 0031 Structured data, sitemaps, crawler rules, IndexNow and llms.txt

**Status:** Accepted, 13 November 2026

## Context

PRD sections 13 and 14 set what search engines and AI assistants get: structured data per template, sitemaps by type, robots rules for search and AI crawlers, IndexNow pings and an llms.txt.

## Decision

- Organization (with the business-wide 14-day returns policy) and WebSite with a search action go on every page; BreadcrumbList with the visible breadcrumbs on every page below the homepage.
- Product has one Offer, for the option the page opens on, with availability, and GTIN from the barcode or else our SKU as the MPN. Made-to-measure products override the returns policy. Ranges get CollectionPage with an ItemList; guides get Article.
- A sitemap index points to one sitemap per type (products, ranges, guides, inspiration, pages), each listing only published, indexable pages, with lastmod only where a real date exists.
- robots.txt welcomes search and AI search crawlers and keeps them out of private pages. Training crawlers follow `AI_TRAINING_CRAWLERS` (allow by default). Outside production everything is blocked.
- IndexNow sits behind a port: after each revalidation the changed product pages are announced; outside production the port does nothing. The key is served at `/indexnow-key.txt`.
- llms.txt is generated from the same content as the sitemaps.

## Consequences

- The e2e SEO check validates the structured data on every template against Google's required fields; the Rich Results Test is still run by hand before launch.
- Shipping details (hasShippingService) and social profiles (sameAs) wait for the delivery rates and the profile links.
- Products without a price have no Offer, so they can't show as merchant listings.
- Whether to allow AI training crawlers is Talasey's call.
