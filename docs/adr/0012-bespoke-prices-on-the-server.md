# 0012 Made-to-measure prices are worked out on the server

**Status:** Accepted, 13 November 2026

## Context

Bespoke planters are priced from a formula on the customer's measurements and choices, the same formula as the pricing sheet. A price sent from the browser can be changed by anyone.

## Decision

The formula, measurement limits and choices are stored with the product in Medusa. Made-to-measure items are added through their own store route, which works the price out again on the server and ignores any price the browser sends. The plain add-to-basket route refuses made-to-measure products. For Phase 1 the formula sits in the product's metadata; it moves to the product rules module from [0005](/adr/0005-product-rules-in-medusa), with its own admin screen, when staff need to edit formulas.

## Consequences

- Prices can't be changed in the browser. Tests check the Sienna and Linea prices against the sheet.
- Until the admin screen exists, formula changes are a developer task.
