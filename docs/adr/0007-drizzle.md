# 0007 Drizzle in the NestJS services

**Status:** Accepted, 12 November 2026

## Context

Our services need typed database access and migrations we can read and review.

## Decision

Drizzle ORM with the `postgres` driver. The schema is TypeScript in `src/database/schema.ts`; `drizzle-kit generate` writes plain SQL migrations into `drizzle/`, which we commit.

## Consequences

- Queries are typed from the schema with no code generation step.
- Migrations are plain SQL anyone can review.
- Repositories sit behind interfaces, so tests use in-memory versions and only the integration tests need Postgres.
