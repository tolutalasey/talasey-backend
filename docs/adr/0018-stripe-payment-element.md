# 0018 Card payments through Stripe’s Payment Element

**Status:** Accepted, 13 November 2026

## Context

[0016](/adr/0016-payment-providers) left the storefront's card form to build. Card details must only ever be typed into Stripe's own fields, and the checkout must still run with no Stripe account.

## Decision

The storefront shows Stripe's Payment Element only when `STRIPE_PUBLISHABLE_KEY` is set, and then pays through `pp_stripe_stripe`. Without it, it uses `MEDUSA_PAYMENT_PROVIDER` and the plain "Place order" button.

The payment step opens a Stripe payment session for the basket through Medusa and reuses it while the total stays the same. The browser confirms the payment with Stripe, then a server action completes the basket; Medusa checks the payment with Stripe before it creates the order. Payments that need another page (a bank check, Klarna) come back to `/checkout/paid`, which completes the basket the same way.

The content security policy lets Stripe's scripts and frames in only when card payments are on.

## Consequences

- Card details never touch our servers.
- One setting switches card payments on; the secret key stays in Medusa (`STRIPE_API_KEY`).
- The card form has only been tested without keys. It needs a run with Stripe test keys before go-live.
- Paying by card needs JavaScript, because Stripe's fields do.
