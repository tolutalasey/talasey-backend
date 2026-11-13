# 0025 URL map, redirects and consent before launch

**Status:** Accepted, 13 November 2026

## Context

PRD section 13 fixes a keyword map and URL rules, and asks for a tested redirect map from every old talasey.co.uk address. Section 16 asks for a typed event schema checked in CI and a consent dialog that loads no Google tag until the visitor chooses. We have no Vercel Edge Config, consent platform or tag manager yet.

## Decision

- The keyword map (11 keywords, their main pages and supporting pages) lives in the storefront as code, and a test runs the URL rules over every path: lowercase words and single hyphens, no dates, no codes or IDs, a slash at both ends.
- Redirects come through a `RedirectSource` port. Locally it is a file in the repo; when `EDGE_CONFIG` is set it is the `redirects` item in Vercel Edge Config, read over its REST API. `proxy.ts` keeps the map in memory for a minute, answers matches with a 301 (or 302 for temporary moves) and keeps the query string. A test fails on loops, chains and duplicates.
- Our own consent dialog (the design system's `ConsentDialog`) with Accept all and Reject all the same size. A script at the top of `<head>` sets Consent Mode v2 defaults to denied; a choice sends a Consent Mode update and is kept for 6 months in a first-party cookie. "Cookie settings" in the footer opens it again.
- The whole PRD event plan is one Zod schema in `@talasey/analytics`, with a test that compares it with the PRD list.

## Consequences

- Without JavaScript nothing is tracked and no dialog shows.
- The PRD asks for a certified consent platform. Ours follows the same rules but isn't certified; swapping later only changes the dialog and where the choice is stored.
- The redirect map is empty until the old site is crawled. The Edge Config adapter is unit-tested only.
- Nothing sends events yet: there is no tag manager. Components can call `track()` as they're built.
