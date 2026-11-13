# 0016 Stripe only when its keys are set

**Status:** Accepted, 13 November 2026. The storefront card form: see [0018](/adr/0018-stripe-payment-element)

## Context

The checkout must run on a laptop and in previews without a Stripe account, and the real shop must take card payments.

## Decision

Medusa loads the Stripe payment provider only when `STRIPE_API_KEY` is set. Without it, Medusa's built-in system provider places orders without taking payment. The seed gives the UK region whichever provider is active, and the storefront uses `MEDUSA_PAYMENT_PROVIDER`.

## Consequences

- Anyone can run the full checkout locally with no keys.
- The storefront's card form (Stripe Elements) is still to build, before go-live.
- Production must never run without Stripe keys. This needs adding to the deploy runbook before go-live.
