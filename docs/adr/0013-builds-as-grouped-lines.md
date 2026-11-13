# 0013 Builds are basket lines grouped by a build id

**Status:** Accepted, 13 November 2026

## Context

A build, such as a fence run, is several products bought together. The order needs each product as its own line for stock and fulfilment, but the customer and the team need to see which lines belong together and where each part goes.

## Decision

Adding a build creates one basket line per product code, all sharing a `build_id`. Parts with the same code are combined into one line, and the per-side detail is kept on the line.

## Consequences

- Stock, prices and fulfilment work on normal lines.
- Two builds of the same products stay apart, and loose items never merge into a build.
- Changing a build means removing its lines and adding it again; there is no "edit build" yet.
