# Talasey backend

The NestJS API behind the consumer site. It owns the data: catalogue, prices, basket, checkout, orders, payments, delivery, content, staff accounts and the audit log. Postgres through Drizzle, Redis for sessions, cache, locks and jobs.

## Run

```sh
npm install
npm run db       # Postgres and Redis, leave running
npm run setup    # .env, migrations, demo staff and products
npm run dev      # http://localhost:4000, API docs at /docs
```

The site is the separate `talasey-frontend` project, kept next to this one. Full steps for both: [docs/runbooks/local-setup.md](docs/runbooks/local-setup.md). All the project docs are in [docs](docs/README.md).

Demo staff accounts (not created in production), all with the password `talasey-demo`: `owner@`, `catalogue@`, `editor@` and `contributor@talasey.local`.

## Redis

Everything short-lived goes through the `KeyValueStore` port (`src/store`): staff sessions, failed sign-in counts, locks and the job queue. With `REDIS_URL` set it is Redis; without it, an in-memory store with the same behaviour (fine for one local process, not for production, where `REDIS_URL` is required). The same test suite runs against both (`key-value-store.contract.ts`).

## Delivery

| Endpoint                                | What it does                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /delivery/zones/:postcode`         | The delivery zone for a UK postcode. 400 if it isn't a valid postcode, 404 if we don't cover the area                                               |
| `GET /delivery/quotes`                  | Price for `postcode`, `shipment` (`parcel` or `pallet`) and `weightKg`, in pence inc. VAT. 422 if no weight band fits                               |
| `GET /delivery/slots?postcode=`         | Pallet delivery days after the zone's lead time, with how many places are left                                                                      |
| `POST /delivery/slot-holds`             | Hold a day for a basket (`postcode`, `date`, `reference`). 409 if the day is full, 422 if we don't offer that date                                  |
| `GET /delivery/slot-holds/:id`          | A hold and whether it's still active                                                                                                                |
| `POST /delivery/slot-holds/:id/confirm` | Book the hold when the order is placed. Safe to repeat. 409 if it was released, or expired and the day filled up                                    |
| `DELETE /delivery/slot-holds/:id`       | Release a hold. A booked hold stays booked                                                                                                          |
| `/admin/delivery/zones`                 | Staff with the delivery permission list, save and delete zones (areas, rates, pallets per day, lead time) and see each day's held and booked places |

- A hold lasts `SLOT_HOLD_MINUTES` (15 by default). Each `reference` has at most one active hold: holding a new day releases the old one, but only once the new day is secured.
- A day's places are taken by booked holds and by held ones that haven't expired. Holding and confirming lock the day's row in Postgres, so two checkouts can't take the last place. A Redis lock per day queues checkouts across API instances first, and the count of places taken is cached in Redis for 15 seconds and cleared by any change.
- Days are working days (Monday to Friday) in London time. Bank holidays aren't excluded yet.
- The seeded zones and rates are sample data (`sample: true` in every response) until the carrier's tables arrive. The seed only fills empty tables, so it never overwrites zones saved in the admin; saving a zone marks it as real.

## Catalogue

Products, options (variants), prices in pence including VAT, stock, photos, colour sets and categories. Every product has a page type from PRD section 10 (1A standard, 1B standard with a colour set, 2 made to measure, 3 enquiry only, 4 build your own) and a stock mode (stocked, made to order, or stocked then made to order).

| Endpoint                          | What it does                                                                |
| --------------------------------- | --------------------------------------------------------------------------- |
| `GET /store/products`             | Published products, from a Redis copy that any catalogue change clears      |
| `GET /store/products/:handle`     | One published product                                                       |
| `GET /store/products/:id/colours` | The colours to offer for the options picked so far (`selected[Finish]=…`)   |
| `/admin/products`                 | List, search, create, edit and delete products (catalogue staff)            |
| `/admin/colour-sets`              | Colour sets; a set products use can't be deleted                            |
| `GET /admin/catalogue/sku-checks` | Missing and duplicate SKUs, colour codes in 1B SKUs, product codes in names |

A save is checked as a whole (`rules/product-problems.ts`) and refused with a list of what to fix. Each save is one entry in the audit log, so any earlier version can be restored. After a change the API asks the site to refresh its cached pages through the job queue (`site/`).

### Importing the master sheet

```sh
cp ~/Downloads/Talasey_Product_Master_Sheet_filled.xlsx .data/pim/   # once; .data is not in git
npm run catalogue:import -- --dry-run               # what would change
npm run catalogue:import
```

The importer reads the sheet behind the `PimSource` port, so a PIM can replace it later. Products are matched by handle, then by any of their SKUs; a match keeps its handle (and URL). A price left blank in the sheet never clears a price set in the admin. Running it twice changes nothing the second time. Today's sheet: 590 rows, 171 products (54 with options, 117 single), 437 SKUs, 153 held back, 301 without a price; 20 products get a colour set (page type 1B).

## Basket, checkout and orders

Baskets live in Postgres under a random id the site keeps in a cookie. Prices are always worked out on the server: a line's price is the option's price now, and a made-to-measure line is priced from its sizes and choices when it is added (`bespoke/`). Delivery is quoted from the basket's weight and postcode each time the basket is read.

| Endpoint                                                    | What it does                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `POST /store/baskets`, `GET /store/baskets/:id`             | Start and read a basket                                                 |
| `POST …/lines`, `PATCH …/lines/:lineId`                     | Add an option (with a colour for 1B), change a quantity (0 removes it)  |
| `POST …/bespoke-items`, `POST …/builds`                     | Made-to-measure items and builds (one line per SKU, kept together)      |
| `PUT …/contact`, `GET …/delivery-options`, `PUT …/delivery` | Email and address, then pallet or parcel                                |
| `GET …/delivery-days`, `PUT …/delivery-day`, `PUT …/access` | Pallet day (held for 15 minutes) and the lorry access answers           |
| `POST …/payment`, `POST …/complete`                         | Start the payment, then place the order (safe to repeat)                |
| `GET /store/orders/:id`                                     | The confirmation page's order                                           |
| `/admin/orders`                                             | Orders for staff, with the delivery day, the access answers and refunds |

The four checks that guard every order, each an integration test in `test/checkout.int.test.ts`:

1. Made-to-measure prices come from the server; a price sent by the browser is ignored.
2. A 1B product needs a colour from its set when the option calls for one, and only then.
3. A pallet order needs a held day and the lorry access answers.
4. The held day must still be held, for this basket and postcode, when the order is placed.

Placing the order copies the lines (so later price changes never alter it), takes stocked quantities off the stock count and queues an `order-placed` job, which books the held day. If the day can't be booked any more, the order stands and is marked `needs-rebooking` for the team.

### Payments

With `STRIPE_SECRET_KEY` set, checkout uses Stripe's Payment Element (cards, Apple Pay, Google Pay, Klarna, and PayPal once switched on in the Stripe dashboard); the order is only placed when Stripe says the payment for that basket and that amount succeeded. `POST /payments/stripe/webhook` (needs `STRIPE_WEBHOOK_SECRET`) places orders for payments that finish after the shopper has left. Refunds from the admin go back through Stripe.

Without Stripe keys the API uses a **test payment**: no money moves, the site says so on the payment step, and orders record `test` as how they were paid.

## Content

Pages, the homepage, guides, FAQs, inspiration photos, navigation, site settings, redirects, email wording and approved legal and finance wording. Each type is defined once in `src/content/content-types.ts`: its fields (which draw the editing form in `/content`) and its rules (checked before publishing, such as search text lengths and URL slugs).

- Every document has a **draft** and a **published** copy. Saving changes only the draft; the site shows the published copy until an editor publishes again.
- Contributors write and save drafts. Editors (and the owner) publish, unpublish and delete. Only the owner publishes legal and finance wording.
- Drafts save even when unfinished and come back with a list of what to fix; publishing refuses until the list is empty.
- **Releases** (`/content/releases`) group drafts that must go live together. Publishing a release publishes the current draft of each document in one transaction: all or nothing. A release can be scheduled; `ReleaseScheduler` checks every 30 seconds (behind a lock, so only one API instance publishes) and publishes as the person who scheduled it. Any change to a scheduled release puts it back to unscheduled.
- Every save and publish is in the audit log and can be restored.
- `GET /store/content/:type` gives the site what is published, nothing else.

Photos go through `POST /admin/uploads` (JPEG, PNG or WebP up to 10 MB, checked from the file itself) to the `FileStorage` port: local disk under `UPLOAD_DIR` now, an S3 or R2 adapter later. They are served at `/uploads/…`.

Emails go through the `Mailer` port. Locally they are written to `.data/outbox` to read; the order confirmation uses the published "order-confirmation" email wording.

## Staff and roles

| Role        | Can                                                     |
| ----------- | ------------------------------------------------------- |
| owner       | everything, including staff accounts                    |
| catalogue   | products, prices, photos, stock, orders and delivery    |
| editor      | write and publish content                               |
| contributor | write content and save drafts; an editor publishes them |

`POST /auth/sign-in` returns a session token; send it as `Authorization: Bearer …`. Sessions last `SESSION_DAYS` from last use. Five wrong passwords lock an email for 15 minutes.

With two-factor on (`POST /auth/two-factor/setup`, then `/auth/two-factor/on` with a code from the app), sign-in returns `{ status: 'code-needed', challenge }` instead of a token; `POST /auth/sign-in/code` with the challenge and a 6-digit code finishes it. Codes are standard time-based codes (RFC 6238, 30 seconds), each accepted once, and wrong codes count towards the same lockout. An owner can switch two-factor off for someone who lost their phone (`PATCH /admin/users/:id` with `twoFactor: false`). `POST /auth/password` changes your own password.

The first owner of a real setup: `npm run staff:create-owner -- <email> "<name>"`.

## Audit log

Every change to an audited thing records its whole state before and after. `POST /admin/audit/:id/restore` puts back the state from before that change and logs the restore as a change of its own. Each module registers a `Restorer` for its things.

## Test

Integration tests empty the catalogue of the database they run on, so they only run against a database whose name ends in `_test` (`npm run db` creates `api_test`).

```sh
npm run test                                   # unit and HTTP tests, no database
npm run test:int                               # against api_test from `npm run db`
REDIS_URL=redis://localhost:6379 npm run test:int   # and Redis too
```

## API contract

Requests and responses are zod schemas (`src/**/*.schemas.ts`); `src/common/contract.ts` validates with them and writes them into the OpenAPI document. `openapi.json` is committed. After changing an endpoint run `npm run openapi` here, commit `openapi.json`, then `npm run api:types` in the frontend.

## Database

Schema in `src/database/schema/`. After a change run `npm run db:generate` and commit the new file in `drizzle/`.
