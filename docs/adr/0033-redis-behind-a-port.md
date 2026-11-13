# 0033 Redis for short-lived state, behind a port

**Status:** Accepted, 13 November 2026

## Context

The API needs somewhere fast and shared for staff sessions, failed sign-in counts, cached product lists, locks around pallet days and a job queue. Locally there is no Docker and no admin rights on the Mac.

## Decision

Everything short-lived goes through one `KeyValueStore` port with two adapters: Redis (`ioredis`) and an in-memory store with the same behaviour. `REDIS_URL` picks Redis; production refuses to start without it.

Locally, `pnpm db` runs a real Redis-compatible server: Valkey, the open-source fork of Redis. It uses `valkey-server` or `redis-server` if one is installed; otherwise it builds Valkey from source into `.data/redis` the first time (about a minute; needs only the command line tools that git already uses on a Mac). If that fails, the API uses the in-memory store and says so.

The same test suite runs against both adapters, and the integration tests run against a real Redis.

## Consequences

- Sessions survive an API restart and work across several API instances.
- Pallet holds still rely on Postgres row locks for the "never overbook" guarantee; the Redis lock in front only queues checkouts for the same day across instances.
- Nothing in Redis is the only copy of anything that matters: orders, holds and content are in Postgres.
