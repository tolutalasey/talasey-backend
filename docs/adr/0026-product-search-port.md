# 0026 The storefront searches through a ProductSearch port

**Status:** Accepted, 13 November 2026

## Context

Range pages, category pages, search results and the instant search all need the same thing: products in a scope, filtered, counted by facet, sorted and paged. [0024](/adr/0024-search-behind-a-port) put the writing side of search behind a port so the commerce server can feed Algolia. There is still no Algolia account, and the site has to work and be tested locally.

## Decision

- The storefront reads through a `ProductSearch` interface (`search` and `suggest`) in `features/search`.
- The local adapter indexes the published Medusa products in memory, from one cached list of every product with prices. It matches the start of the last word as people type, forgives one typo from 4 letters and two from 8 (like Algolia's defaults), knows other words for the same thing (slabs, flags and patio for paving; corten for weathered steel) and, when no product matches every word, returns the ones that match some and says so.
- Facets are colour, finish, size, brand, price band and availability. Each facet is counted as if its own filter were off, so people see what another choice would give them.
- The Algolia adapter reads with a search-only key, from the records the commerce server writes. Those records now carry options, brand, category handles and availability.
- The adapter is chosen by environment: Algolia when `ALGOLIA_APP_ID` and `ALGOLIA_SEARCH_KEY` are set, local otherwise.

## Consequences

- Ranges, search and suggestions behave the same locally and in tests as they will on Algolia, apart from facet counts: the Algolia adapter counts from one query, so counts narrow as filters are added.
- The local index holds every published product in memory. That is fine for hundreds of products; past a few thousand, use Algolia.
- Thickness, slip rating, use and price per m² can't be filtered yet: the product data doesn't have them. A facet with no values is never shown.
- The Algolia adapter is unit-tested against a fake `fetch` only. It needs an index with the right searchable attributes, facets and replica indexes for each sort before launch.
