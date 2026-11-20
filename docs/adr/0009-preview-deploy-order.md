# 0009 Preview deploy order

**Status:** Accepted, 12 November 2026

## Context

The storefront depends on the back-end API. Deploying the front end first can briefly point new pages at an old API.

## Decision

Every environment deploys in this order: back end, then migrations (run by the API's start command), then the front end, then tests against the new URL.

## Consequences

- New pages never call an API that isn't there yet.
- Migrations must work with the code that's already running, because it keeps serving while they run.
- A failed migration stops the deploy before anything user-facing changes.
