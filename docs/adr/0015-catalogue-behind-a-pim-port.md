# 0015 The catalogue is imported through a PIM port

**Status:** Accepted, 13 November 2026. Updates to existing products: replaced by [0019](/adr/0019-import-updates-products)

## Context

Today the catalogue lives in the product master sheet. We may move to a PIM (see [Choosing a PIM](/pim-comparison)), and the choice isn't made.

## Decision

The importer reads products through a `PimSource` interface. The first adapter reads the master sheet (.xlsx) with a small reader instead of a full spreadsheet library. The importer creates missing categories and products and leaves products already in Medusa alone. Products with no price at all come in as drafts.

## Consequences

- Moving to a PIM means writing one adapter.
- Running the import again is safe, but it doesn't update products that already exist. Updates come with the PIM sync.
- The sheet itself stays out of git; it is copied into `.data/pim` to run the import.
