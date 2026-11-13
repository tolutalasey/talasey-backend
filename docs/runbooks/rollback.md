# Roll back

Roll back first, investigate second.

## Site (Vercel)

```sh
vercel rollback --token "$VERCEL_TOKEN"            # to the previous production deployment
vercel rollback <deployment-url> --token "$VERCEL_TOKEN"
```

Or in the Vercel dashboard: Deployments → pick the last good one → Promote. It takes seconds and needs no build.

## API (Railway)

In the Railway dashboard, open `api` → Deployments → the last good one → Redeploy.

## Data changed by staff

Use the change log in `/admin` (**Put back as before**) for products, colour sets, delivery zones, content and staff accounts. No deploy needed.

## Database migrations

We don't roll migrations back automatically. Migrations are written to be backwards compatible, so the old code runs on the new schema. If a migration damaged data, restore the Railway Postgres backup to a new database, check it, then point the API at it.

## After

- Tell the team what happened and what's live.
- Write a short incident note: what broke, how we noticed, what we'll change.
