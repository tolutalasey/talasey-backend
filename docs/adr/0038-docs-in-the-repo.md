# 0038 Docs as Markdown in the repo

**Status:** Accepted, 13 November 2026

## Context

The docs were a Next.js site of their own, one more app to build and deploy.

## Decision

The docs are Markdown files in `/docs`: architecture, runbooks, guides for staff, and these decision records. GitHub shows them as they are. The records written for the docs site were moved here unchanged.

## Consequences

- Nothing to deploy; docs change in the same pull request as the code (CI still checks for that).
