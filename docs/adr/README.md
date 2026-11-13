# Decision records

One short record per decision. We never rewrite one; a new record replaces it, and this list says which.

| Record                                                                                    | Status                                                    |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [0001 Monorepo with pnpm and Turborepo](0001-monorepo.md)                                 | Replaced by 0039                                          |
| [0002 Medusa as the commerce engine](0002-medusa.md)                                      | Replaced by 0032                                          |
| [0003 Sanity Studio hosted on Vercel](0003-sanity-studio-on-vercel.md)                    | Replaced by 0032 and 0034                                 |
| [0004 Hosting on Vercel and Railway](0004-hosting.md)                                     | Accepted                                                  |
| [0005 Product rules as Medusa modules](0005-product-rules-in-medusa.md)                   | Replaced by 0032 and 0036                                 |
| [0006 Content in Sanity, commerce data in Medusa](0006-content-and-commerce-data.md)      | Replaced by 0032                                          |
| [0007 Drizzle in the NestJS services](0007-drizzle.md)                                    | Accepted, now in `apps/api`                               |
| [0008 Vitest everywhere, Jest in commerce](0008-test-runners.md)                          | Accepted; Jest went with Medusa                           |
| [0009 Preview deploy order](0009-preview-deploy-order.md)                                 | Accepted                                                  |
| [0010 Content Security Policy](0010-content-security-policy.md)                           | Accepted                                                  |
| [0011 Pallet days held, then booked](0011-pallet-day-holds.md)                            | Accepted                                                  |
| [0012 Made-to-measure prices on the server](0012-bespoke-prices-on-the-server.md)         | Accepted                                                  |
| [0013 Builds as grouped basket lines](0013-builds-as-grouped-lines.md)                    | Accepted                                                  |
| [0014 Stock modes from Medusa inventory](0014-stock-modes.md)                             | Accepted; the modes now live on the product in `apps/api` |
| [0015 Catalogue through a PIM port](0015-catalogue-behind-a-pim-port.md)                  | Accepted                                                  |
| [0016 Stripe only when its keys are set](0016-payment-providers.md)                       | Replaced by 0035                                          |
| [0017 Checkout on server actions](0017-checkout-with-server-actions.md)                   | Accepted                                                  |
| [0018 Stripe Payment Element](0018-stripe-payment-element.md)                             | Accepted                                                  |
| [0019 Import updates existing products](0019-import-updates-products.md)                  | Accepted                                                  |
| [0020 Checkout without JavaScript](0020-checkout-without-javascript.md)                   | Accepted                                                  |
| [0021 Design system](0021-design-system.md)                                               | Accepted                                                  |
| [0022 Content model in Sanity](0022-content-model-in-sanity.md)                           | Replaced by 0034                                          |
| [0023 Catalogue rules module](0023-catalogue-rules-module.md)                             | Replaced by 0032                                          |
| [0024 Search behind a port](0024-search-behind-a-port.md)                                 | Accepted                                                  |
| [0025 URLs, redirects and consent](0025-urls-redirects-and-consent.md)                    | Accepted; redirects are now also published in `/content`  |
| [0026 Product search port](0026-product-search-port.md)                                   | Accepted                                                  |
| [0027 One URL per filter state](0027-one-url-per-filter-state.md)                         | Accepted                                                  |
| [0028 Purchase areas](0028-purchase-areas.md)                                             | Accepted                                                  |
| [0029 Placeholder content](0029-placeholder-content.md)                                   | Accepted                                                  |
| [0030 Enquiries behind a port](0030-enquiries-behind-a-port.md)                           | Accepted                                                  |
| [0031 Structured data and crawlers](0031-structured-data-and-crawlers.md)                 | Accepted                                                  |
| [0032 Two apps instead of six](0032-two-apps.md)                                          | Accepted                                                  |
| [0033 Redis for short-lived state, behind a port](0033-redis-behind-a-port.md)            | Accepted                                                  |
| [0034 Content and publishing in the API](0034-content-in-the-api.md)                      | Accepted                                                  |
| [0035 Payments through Stripe in the API, or a test payment](0035-payments-in-the-api.md) | Accepted                                                  |
| [0036 Staff accounts, roles and the audit log](0036-staff-and-audit-log.md)               | Accepted                                                  |
| [0037 Zod schemas as the API contract](0037-zod-contracts.md)                             | Accepted                                                  |
| [0038 Docs as Markdown in the repo](0038-docs-in-the-repo.md)                             | Accepted                                                  |
| [0039 Frontend and backend as two projects](0039-two-projects.md)                         | Accepted                                                  |
