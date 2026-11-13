# 0017 Checkout runs on server actions

**Status:** Accepted, 13 November 2026. Without JavaScript: see [0020](/adr/0020-checkout-without-javascript)

## Context

The checkout talks to Medusa at every step. Calling Medusa from the browser would put the publishable key, CORS settings and commerce code in the client bundle.

## Decision

Each checkout step is a Next.js server action that calls Medusa through `@talasey/commerce-client`. The basket id is kept in an httpOnly cookie. Steps appear in order (address, delivery, day, access, payment) based on what the basket already has, and forms use React Aria components from `@talasey/ui`.

## Consequences

- No commerce code or keys reach the browser, and the forms submit even before JavaScript has loaded.
- Every step is a round trip to our server, which is fine for a form-by-form checkout.
- Live price updates while typing would need a client-side call later.
