# Deploy

Deploys are automatic once hosting is paid for. You don't run them by hand.

| Trigger                  | Goes to                                                    |
| ------------------------ | ---------------------------------------------------------- |
| Pull request             | Vercel preview and a Railway PR environment                |
| Merge to `main`          | Staging                                                    |
| GitHub release published | Production, after approval in the `production` environment |

## Order

Each project deploys from its own repo. Release the backend first when both change (ADR 0009, 0039):

1. **API.** Railway deploys `talasey-backend`. Its pre-deploy step runs the migrations; if one fails, the deploy stops and the old version keeps serving.
2. **Site.** Vercel builds and deploys `talasey-frontend`.
3. **Smoke tests.** Playwright runs against the new URL. If they fail on production, the workflow rolls back.

## Settings

- API (Railway): `DATABASE_URL`, `REDIS_URL` (required in production), `WEB_URL`, `REVALIDATE_SECRET`, and for payments `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- Site (Vercel): `APP_ENV`, `SITE_URL`, `API_URL`, `REVALIDATE_SECRET` (the same value), and `STRIPE_PUBLISHABLE_KEY` for payments.
- GitHub (Settings → Environments): `RAILWAY_TOKEN` on the backend repo; `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` on the frontend repo. Without them the deploy steps skip and say so.
- The frontend's CI checks out the backend to run the end-to-end tests: set the `BACKEND_REPO` variable if it isn't `tolutalasey/talasey-backend`, and a `BACKEND_REPO_TOKEN` secret with read access if the backend repo is private.

Production gets no demo accounts. A script to create the first owner there is still to write; staging can use the demo accounts.

## Before a release

- `main` is green and staging has been checked.
- Release notes written in plain English.
- Any migration is backwards compatible with the running code (add columns first, remove later).
