# 0001 Monorepo with pnpm and Turborepo

**Status:** Accepted, 12 November 2026

## Context

We have a storefront, a commerce engine, our own services, a content studio and shared packages. A change to an API and the pages that use it often go together.

## Decision

One repository with pnpm workspaces and Turborepo. Apps live in `apps/`, shared code in `packages/`. Exact dependency versions sit in one pnpm catalog in `pnpm-workspace.yaml`.

## Consequences

- An API change and the pages that use it land in one pull request.
- Turborepo caches results, so CI only builds and tests what changed.
- Each app still deploys on its own.
- One lockfile to keep healthy, and the repo is bigger to clone. If someone should only see one part, we split that part into its own repository and bring it in as a package.
