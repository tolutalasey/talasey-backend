# Architecture

Two apps (ADR 0032), each its own project (ADR 0039). The site renders pages; the API owns the data.

```
                 ┌───────── talasey-frontend (Next.js, Vercel) ───────┐
Browser ───────► │  public site      /admin (staff)    /content (editors) │
                 └───────────────┬─────────────────────────────────────┘
                                 │ server-side only, typed client
                                 ▼
                 talasey-backend (NestJS, Railway) ──► Postgres (Drizzle)
                                                   └─► Redis: sessions, cache, locks, jobs
                                                   └─► Stripe (when keys are set)
```

## talasey-frontend

- Next.js 16 with Cache Components. Public pages are cached and tagged; the API asks the site to refresh only the tags that changed.
- Three route groups with their own layouts: `(site)` for the shop, `(staff)` for `/admin` and `/content`. The shop's header, consent dialog and analytics never load on staff pages, and staff code never loads on shop pages. Staff pages are `noindex` and need a sign-in.
- It reads data only through `src/api-client` and `src/lib`. Nothing in the browser talks to the API directly; photos uploaded in the admin are served through the site's own `/uploads/…`.
- Forms are server actions and work without JavaScript (ADR 0020).

## talasey-backend

- One module per area, each controller → service → repository, with ports in front of anything that could change: `KeyValueStore` (Redis or memory), `PaymentProvider` (Stripe or test), `FileStorage` (local disk, S3 later), `Mailer` (local outbox, an email service later), `PimSource` (the master sheet, a PIM later).
- Requests and responses are zod schemas, which also write the OpenAPI document (ADR 0037).
- Every staff change is in one audit log with the whole state before and after, so any change can be undone (ADR 0036).

| Area                                       | What it owns                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `auth`                                     | Staff accounts, roles, sessions                                                                                |
| `audit`                                    | The change log and restoring from it                                                                           |
| `catalogue`                                | Products, options, prices, stock modes, photos, colour sets, SKU checks, the importer, made-to-measure pricing |
| `delivery`, `slots`                        | Postcode zones, rates, pallet days, holds and bookings                                                         |
| `basket`, `checkout`, `orders`, `payments` | Baskets, delivery choice, the checks before an order, orders, refunds                                          |
| `content`, `uploads`, `mail`               | Content documents with drafts and publishing, photos, emails                                                   |
| `store`, `jobs`, `site`                    | Redis, the job queue, telling the site to refresh                                                              |

## How data stays fresh

1. Someone saves a product in `/admin` or publishes a guide in `/content`.
2. The API clears its Redis copy and queues a `site-refresh` job.
3. The job posts `{ "tags": ["products", "product:<handle>"] }` (or `content:<type>`) to the site's `/api/revalidate`, signed with HMAC-SHA256 and a timestamp.
4. The site checks the signature and refreshes those tags. The next visitor gets the change; the one after the refresh sees it at full speed.

## Environments

| Environment  | Site             | API                                      | Indexed |
| ------------ | ---------------- | ---------------------------------------- | ------- |
| Local        | `pnpm dev`       | `pnpm db` (embedded Postgres and Valkey) | No      |
| Pull request | Vercel preview   | Railway PR environment                   | No      |
| Staging      | Vercel, `main`   | Railway staging                          | No      |
| Production   | Vercel, releases | Railway production                       | Yes     |

Only `APP_ENV=production` is indexable. Everywhere else sends `X-Robots-Tag: noindex` and a blocking `robots.txt`.
