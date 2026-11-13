# 0024 Product search records go through a SearchIndex port

**Status:** Accepted, 13 November 2026

## Context

PRD section 9 puts search on Algolia. There is no Algolia account yet, and the site must build and test locally without one.

## Decision

The commerce server writes product search records through a `SearchIndex` interface. A subscriber on product created, updated and deleted builds the record (published products only) and saves or removes it. Changing a product's Talasey settings sends a product updated event too.

Two adapters exist: an in-memory one, used whenever `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY` aren't set, and an Algolia one that calls Algolia's REST batch endpoint directly, so no SDK is needed.

## Consequences

- Local runs and tests index into memory; integration tests read it to check records.
- The Algolia adapter is unit-tested against a fake `fetch` but has never talked to Algolia. It needs a run with real keys and an index with the right searchable attributes before launch.
- A full reindex command is still to write, for the first load and after changing what a record holds.
