# 0037 Zod schemas as the API contract

**Status:** Accepted, 13 November 2026

## Context

The services app described requests and responses twice: zod for validation and DTO classes for OpenAPI. They could drift.

## Decision

Each endpoint has zod schemas for what it accepts and returns. `common/contract.ts` validates with them and writes them into the OpenAPI document (`Accepts`, `Returns`, `ValidBody`, `ValidQuery`). `openapi.json` is committed and `packages/api-client` is generated from it with `openapi-typescript`; CI fails if either is out of date.

## Consequences

- One definition per shape, so the docs, the validation and the web app's types agree.
- Response schemas are inlined rather than named components, so the generated types are read through the paths (`paths['/store/products']['get']…`).
