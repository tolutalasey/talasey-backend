# 0002 Medusa as the commerce engine

**Status:** Accepted, 12 November 2026

## Context

We need a basket and checkout that handle pallet delivery slots, access questions and our own delivery rules. Headless WooCommerce has weak bot protection on its checkout API; hosted platforms limit how far we can change checkout (PRD section 8).

## Decision

Medusa v2, self-hosted. All `@medusajs/*` packages are pinned to the same exact version. We don't use the Medusa starter storefront.

## Consequences

- No licence fee or fee on sales; the same TypeScript and Postgres stack as our services.
- We own hosting, security and upgrades. We take Medusa upgrades monthly, as one grouped Renovate pull request.
- The admin build needs Medusa's packages hoisted (`publicHoistPattern` in `pnpm-workspace.yaml`).
