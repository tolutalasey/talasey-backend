# 0039 Frontend and backend as two projects

**Status:** Accepted, 13 November 2026. Supersedes 0001.

## Context

After ADR 0032 we had two apps, but still inside a monorepo: pnpm workspaces, Turborepo, a shared config package and four small shared packages that only the site used. That is tooling for many apps and teams. With two apps and one developer it mostly added steps: workspace filters, build order between packages and one install for everything.

## Decision

Two separate projects, each with its own Git repository, install, scripts, CI and deploy:

- `talasey-frontend`: the Next.js site, `/admin` and `/content`. The design tokens, components, analytics and API client that were packages are now folders in `src`.
- `talasey-backend`: the NestJS API, Postgres and Redis. It keeps the docs that cover both.

The contract between them is the backend's committed `openapi.json`. After an endpoint changes, `pnpm openapi` in the backend writes it, and `pnpm api:types` in the frontend regenerates the client types from it. The frontend's Playwright tests run against the backend checked out next to it (`../talasey-backend`, or `BACKEND_DIR`).

## Consequences

- Each project installs, builds and tests on its own with plain `pnpm` commands; no workspaces or Turborepo.
- A change that touches both sides is two pull requests, backend first.
- The old monorepo history stays in the `talasey-consumer` repository.
