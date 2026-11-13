# 0008 Vitest everywhere, Jest in commerce

**Status:** Accepted, 12 November 2026

## Context

We want one test runner to learn. Medusa's test utilities are built for Jest.

## Decision

Vitest in every app and package, with shared presets in `packages/config`. Jest in `apps/commerce` only, as Medusa expects.

## Consequences

- The same `describe`/`it`/`expect` style everywhere.
- Commerce tests run with `pnpm --filter @talasey/commerce test` like the rest; Turborepo hides the difference.
- If Medusa supports Vitest later, we move commerce over.
