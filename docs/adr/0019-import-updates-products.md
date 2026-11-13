# 0019 The import updates products already in Medusa

**Status:** Accepted, 13 November 2026

## Context

Under [0015](/adr/0015-catalogue-behind-a-pim-port) the importer left existing products alone, so a fixed price or name in the master sheet never reached the site. Prices and publishing are also changed by hand in the admin, and those changes must not be lost.

## Decision

The importer matches products by handle, then by any of their SKUs, and updates what changed: title, subtitle, description, category, PIM data, and each SKU's title, weight and price.

It never changes a product's handle or status, never clears a price the sheet leaves blank, and never deletes a SKU. A new SKU is added to an existing product when the product already has its option values; otherwise it is skipped with a reason.

`import:catalogue:dry-run` reports the same counts and reasons without writing anything. Medusa's CLI refuses unknown `--` flags, so the dry run is its own script.

## Consequences

- Running the import twice with the same sheet changes nothing the second time.
- URLs and publishing stay in the admin's hands.
- SKUs removed from the sheet stay in Medusa until someone archives them.
- A new size or finish on an existing product needs the option value added in the admin first.
