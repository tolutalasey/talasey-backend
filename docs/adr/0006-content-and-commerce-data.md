# 0006 Content in Sanity, commerce data in Medusa

**Status:** Accepted, 12 November 2026

## Context

A product page mixes selling data (price, SKU, stock) with content (copy, guides, FAQs, images).

## Decision

Medusa owns anything sold: products, variants, SKUs, prices and stock. Sanity owns editorial content, including long product copy, which links to a product by its handle. The storefront joins them at render time.

## Consequences

- One source of truth for each field; no syncing prices into the CMS.
- Editors can improve copy without touching the store admin.
- A product page makes two cached reads, both tagged so they revalidate separately.
