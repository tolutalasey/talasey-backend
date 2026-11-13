# 0005 Product rules as Medusa modules

**Status:** Accepted, 12 November 2026

## Context

Colour sets, bespoke-size formulas and builder rules (PRD section 10) decide what a customer can add to the basket and at what price. The team edits them next to the products they belong to.

## Decision

We build colour sets, formulas and builder rules as custom Medusa modules, with their own admin screens. The NestJS services keep things that cross systems, such as delivery zones, feeds and the installer network.

## Consequences

- The basket and checkout can enforce the rules inside Medusa's workflows, so prices can't be changed in the browser.
- Staff manage rules in the same admin as products.
- These modules follow Medusa's upgrade cycle, so they need tests that run against each upgrade.
