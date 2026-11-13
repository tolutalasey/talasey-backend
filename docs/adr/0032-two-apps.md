# 0032 Two apps instead of six

**Status:** Accepted, 13 November 2026. Supersedes 0002, 0003, 0005, 0006, 0022 and 0023.

## Context

We had six apps: the storefront, Medusa (server and worker), our NestJS services, Sanity Studio, a docs site, plus Postgres and Redis for Medusa. For a company just starting to sell direct, that is too many moving parts: six things to deploy, upgrade and pay for, three admin screens for staff to learn, and our own rules (pallet days, colour sets, made-to-measure prices, stock modes) bolted onto Medusa through modules, workflow hooks and metadata.

## Decision

Two apps:

- `apps/web`: Next.js. The public site, `/admin` for staff and `/content` for editors.
- `apps/api`: NestJS on Postgres (Drizzle) and Redis. It owns everything else: catalogue, prices, basket, checkout, orders, payments, delivery, content, staff accounts and the audit log.

The web app talks to the API from the server only, through `packages/api-client`, generated from the API's OpenAPI document. Medusa, Sanity, the separate services app and the docs site are removed; the docs are Markdown in `/docs`.

## Consequences

- One back end to deploy, migrate and back up; one admin for staff, in the same place as the site.
- Our rules are plain code with unit and integration tests, not extensions of someone else's model.
- We now own the basket and checkout code that Medusa gave us. It is small, because we only sell in the UK, in pounds, with VAT included.
- Payment providers, tax and multi-currency are ours to add if we ever need them. Stripe covers payments (ADR 0035).
- The earlier records stay as they were; this one replaces them.
