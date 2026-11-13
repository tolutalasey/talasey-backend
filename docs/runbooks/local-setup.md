# Run it on your Mac

No Docker, no admin rights, no accounts. Node 24 (22.12 or later works) and npm. The two projects sit side by side:

```
~/Downloads/AppDesign/
  talasey-backend/
  talasey-frontend/
```

## The first time

Backend, in terminal 1. `npm run db` stays running:

```sh
cd ~/Downloads/AppDesign/talasey-backend
npm install
mkdir -p .data/pim && cp ~/Downloads/Talasey_Product_Master_Sheet_filled.xlsx .data/pim/
npm run db
```

This starts Postgres (in `.data/postgres`) and Redis (Valkey, in `.data/redis`). The very first time it builds Valkey from source, which takes about a minute. If that can't work, it says so and the API keeps sessions and cache in memory instead.

Backend, in terminal 2:

```sh
cd ~/Downloads/AppDesign/talasey-backend
npm run setup              # .env, migrations, demo staff and products
npm run catalogue:import   # the master sheet: 171 products
npm run dev                # http://localhost:4000, leave running
```

Frontend, in terminal 3:

```sh
cd ~/Downloads/AppDesign/talasey-frontend
npm install
npm run setup              # .env.local, with the same refresh secret as the backend
npm run dev                # http://localhost:3000
```

## Every day

| Terminal | Folder             | Command       |
| -------- | ------------------ | ------------- |
| 1        | `talasey-backend`  | `npm run db`  |
| 2        | `talasey-backend`  | `npm run dev` |
| 3        | `talasey-frontend` | `npm run dev` |

| What             | Where                                             |
| ---------------- | ------------------------------------------------- |
| The site         | http://localhost:3000                             |
| Staff admin      | http://localhost:3000/admin                       |
| Content editor   | http://localhost:3000/content                     |
| API and its docs | http://localhost:4000, http://localhost:4000/docs |

Demo sign-ins, all with the password `talasey-demo`:

| Email                       | Role                                      |
| --------------------------- | ----------------------------------------- |
| `owner@talasey.local`       | Everything, including staff accounts      |
| `catalogue@talasey.local`   | Products, prices, stock, orders, delivery |
| `editor@talasey.local`      | Content, and publishing it                |
| `contributor@talasey.local` | Content drafts, which an editor publishes |

Orders are paid with the test payment (no money moves). Order emails are written to the backend's `.data/outbox` to read.

## Checks

Backend:

```sh
npm run lint && npm run typecheck && npm run test   # no database needed
npm run test:int                              # against Postgres from `npm run db`
REDIS_URL=redis://localhost:6379 npm run test:int   # and Redis too
```

Frontend:

```sh
npm run lint && npm run typecheck && npm run test
npx playwright install chromium      # once
npm run build && npm run e2e                     # journeys against the real backend (needs `npm run db`)
npm run lighthouse                            # speed, accessibility and SEO on every template
```

## When something is off

- **"Postgres is not running"** from `npm run setup`: start `npm run db` first.
- **"Something is already using port 5432"** from `npm run db`: an old Postgres is still running. Run `pkill -f postgres`, then `npm run db` again.
- **"Postgres could not start"**: `.data/postgres` is from an older setup. `mv .data/postgres .data/postgres-old`, then `npm run db` and `npm run setup` again.
- **Port 3000 or 4000 in use**: an old `npm run dev` is still running. Stop it with Ctrl+C.
- **A product change doesn't show on the site**: reload once more; the site refreshes the page in the background. Check `REVALIDATE_SECRET` is the same in the backend's `.env` and the frontend's `.env.local` (`npm run setup` in the frontend does this).
