# Talasey consumer site docs

The developer and staff documentation for Talasey's direct-to-consumer website. It lives next to the code, so a change and its docs land in the same pull request.

## Two projects

| Project            | What it is                                                                                                    | Deploys to |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ---------- |
| `talasey-frontend` | The website, plus `/admin` for staff and `/content` for editors (Next.js)                                     | Vercel     |
| `talasey-backend`  | Everything behind it: catalogue, basket, checkout, orders, delivery, content, staff (NestJS, Postgres, Redis) | Railway    |

They sit next to each other in one folder. The frontend talks to the backend from the server only, through a typed client generated from the backend's `openapi.json`. These docs live in the backend; the frontend keeps its own design-system and staff guides.

## Start here

- [Run it on your Mac](runbooks/local-setup.md)
- [Demo to Amy](runbooks/demo-to-amy.md)
- [Architecture](architecture.md)
- [Decision records](adr/README.md)

Staff guides (the admin, the content editor, colour sets) and the design system are in the frontend's `docs` folder.

## Reference

- [Product data model](product-data-model.md), [glossary](glossary.md), [PIM comparison](pim-comparison.md)
- [Deploy](runbooks/deploy.md) and [roll back](runbooks/rollback.md)

## How we work

- Small pull requests into `main`, one review, CI green.
- A change to an endpoint, the database schema or an env file needs a matching docs or README change. A changed endpoint also needs `pnpm openapi` here and `pnpm api:types` in the frontend.
- Big decisions get a short decision record. We don't rewrite old ones; a new one replaces it.
