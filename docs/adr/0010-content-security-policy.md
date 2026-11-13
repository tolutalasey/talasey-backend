# 0010 Content Security Policy

**Status:** Accepted, 12 November 2026

## Context

PRD section 17 asks for a strict CSP. Nonces need a fresh value per request, which stops a page being served from the static cache.

## Decision

Static and cached routes use a CSP with hashes of their inline scripts. Only routes that are already dynamic (basket, checkout, account) use per-request nonces.

## Consequences

- Static pages stay fast and cacheable.
- We need a build step that collects inline script hashes. Until it exists (P1), P0 sends a baseline CSP that allows inline scripts but blocks framing, plugins and other origins.
- Any new third-party script needs a CSP change, which is the point.
