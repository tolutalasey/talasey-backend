# 0003 Sanity Studio hosted on Vercel

**Status:** Accepted, 12 November 2026

## Context

Editors need a content admin with drafts, previews and history. Sanity can host the Studio on `*.sanity.studio`, or we can host the built Studio ourselves.

## Decision

We build the Studio from `apps/studio` and host it on Vercel as its own project, on a Talasey subdomain.

## Consequences

- Studio deploys go through the same pull requests, previews and CI as everything else.
- It sits on our domain behind our own access rules.
- One more Vercel project to keep in the company account.
