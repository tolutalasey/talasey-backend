title: '0027 Page paths end in a slash and each filter state has one URL',
};

# 0027 Page paths end in a slash and each filter state has one URL

**Status:** Accepted, 13 November 2026

## Context

The URL rules in [0025](/adr/0025-urls-redirects-and-consent) want paths like `/porcelain-paving/`, but Next.js served pages without the slash. PRD section 13 says filter states must never create indexable URLs, apart from curated pages with their own intro.

## Decision

- `trailingSlash: true` in the storefront. Paths without the slash redirect permanently; files such as `/sitemap.xml` and `/robots.txt` are left alone.
- Filters, sort and page live in the query string in a fixed order (`?finish=powder-coated&size=1800-x-600-mm`). A request written another way, such as a form's repeated fields, redirects to that one URL.
- A filter state that is exactly a curated page's goes to its clean URL (`/garden-screens/powder-coated/`). Curated pages are content: a Sanity page of kind "Colour or size" that points at its range and names its filters.
- Every URL with filters, sort, a page number or product options is `noindex, follow` with the canonical on the clean page, and is never in a sitemap. A range with no products is `noindex` until it has some.
- Filters are a plain GET form, so they work without JavaScript. With JavaScript they apply on change and go straight to the one URL.

## Consequences

- The commerce server calls `/api/revalidate/` with the slash, and checkout's return URL is `/checkout/paid/`.
- Only two curated pages exist (garden screens by finish), because only those have products. The keyword map's colour and size pages wait for products.
- Range and search pages render per request: they read the query string and must show results without JavaScript.
