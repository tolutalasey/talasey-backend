# 0020 The basket and checkout work without JavaScript

**Status:** Accepted, 13 November 2026

## Context

[0017](/adr/0017-checkout-with-server-actions) runs each checkout step as a server action, so the forms post without JavaScript. Two things still broke with JavaScript off. The basket, checkout and order pages streamed their content behind a loading message, and only JavaScript swaps streamed content in. And after a form post, Next.js rendered the page without the action's result, so errors never showed.

## Decision

The basket, checkout and order pages render in full on the server before they are sent (`instant = false`, no Suspense around the page). They hold one shopper's basket, so there was no shared static shell to lose.

Each checkout action also puts its result (errors, and what was typed in the address) in a short-lived, httpOnly cookie. The page rendered straight after the post reads it and hands it to the form as its starting state. The proxy drops the cookie on the next page load, so an error is only shown once. With JavaScript on, the form uses the action's result directly, as before.

## Consequences

- A shopper can check out from product page to confirmation with JavaScript off, and sees every error in words beside the field.
- These pages wait for Medusa before sending anything. They are not cached, so they were never instant.
- Paying by card still needs JavaScript, because Stripe's fields do ([0018](/adr/0018-stripe-payment-element)).
- Errors from "Add to basket" on product pages still need JavaScript; product pages are cached and don't read cookies.
