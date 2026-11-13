# 0004 Hosting on Vercel and Railway

**Status:** Accepted, 12 November 2026

## Context

The storefront needs partial prerendering at the edge. Medusa and our services need long-running Node processes, Postgres and Redis.

## Decision

Vercel for the storefront, Studio and docs. Railway for Medusa (server and worker), the NestJS services, two Postgres databases and Redis, in Railway's EU West region (`europe-west4`). Railway has no UK region yet. Railway config lives in `.railway/railway.ts` as code.

## Consequences

- EU West is close enough to UK users for API calls; pages are served from Vercel's edge in the UK.
- Data is stored in the EU, which is fine under UK GDPR adequacy, and the privacy notice must say so.
- If Railway opens a UK region we move there; the config makes that a small change.
