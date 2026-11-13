# 0035 Payments through Stripe in the API, or a labelled test payment

**Status:** Accepted, 13 November 2026. Supersedes 0016; 0018 still stands.

## Context

Medusa held the Stripe provider. With Medusa gone the API takes payments. We have no Stripe account yet, and the demo must not pretend to take money.

## Decision

A `PaymentProvider` port with two adapters. With `STRIPE_SECRET_KEY` set, the API creates a Stripe PaymentIntent with automatic payment methods, so the Payment Element on the site shows cards, Apple Pay, Google Pay and Klarna (and PayPal once switched on in Stripe). The order is placed only when Stripe says the payment for that basket and that amount succeeded; a webhook places orders for payments that finish after the shopper has left. Refunds go back through Stripe.

Without keys, checkout uses a test payment: the site says "Test payment. Card payments are not switched on here, so no money is taken", and orders record `test` as how they were paid.

## Consequences

- The Stripe path is covered by unit tests with a stand-in for Stripe; it gets its first live test once there is a Stripe test account.
- Turning on payments is two settings, no code.
