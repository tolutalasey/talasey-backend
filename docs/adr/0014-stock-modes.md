# 0014 Stock modes come from Medusa inventory settings

**Status:** Accepted, 13 November 2026

## Context

Some products are always made to order, some are only sold from stock, and some ship what is in the yard and make the rest. Customers need to know which applies before they buy.

## Decision

The mode comes from two settings Medusa already has on each product code: whether stock is tracked and whether backorders are allowed. Not tracked means made to order. Tracked without backorders means stock only. Tracked with backorders means stock first, then made to order. The basket shows each line as, for example, "12 now, 3 made to order".

## Consequences

- No new settings for the team to learn; it is set in the Medusa admin.
- Lines for the same product code share the stock, first line first.
- Lead times for the made-to-order part are not shown yet.
