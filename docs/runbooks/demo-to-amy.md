# Demo to Amy

About twenty minutes, on my Mac, with nothing online. Do the [first-run steps](local-setup.md) the day before, then on the day:

```sh
cd ~/Downloads/AppDesign/talasey-backend && npm run db    # terminal 1
cd ~/Downloads/AppDesign/talasey-backend && npm run dev   # terminal 2
cd ~/Downloads/AppDesign/talasey-frontend && npm run dev  # terminal 3, then open http://localhost:3000
```

## 1. Finding things (3 minutes)

- From the homepage: **Shop by product → Fire pits → Sphere Fire Pit with Stand**. Three clicks.
- Search "decorativ sceen" with the typos: it still finds the screens.
- On **Garden screens**, tick **Powder Coated**: the address becomes `/garden-screens/powder-coated/`, a page Google can find.

## 2. A product and its price (3 minutes)

- **Silver grey porcelain paving**: £89.99 a pack, £62.49 per m². Type an area in m² and it works out the packs with wastage.
- Add 14 packs: the basket says **12 now, 2 made to order**, because 12 are in the yard.
- A powder-coated screen asks for a colour from the colour set before it goes in the basket.

## 3. A pallet order (5 minutes)

- Add 40 tubs of **Pavetuf jointing compound** and go to the checkout.
- Postcode **M1 1AE**: pallet delivery is priced (£65.00, sample rates until the carrier's arrive).
- Pick a day: it is **held** for 15 minutes while you finish.
- The lorry questions must be answered: try **Save delivery access** without answering.
- Pay: it says **Test payment**, because Stripe isn't set up. Place the order.

## 4. The admin (5 minutes)

Open http://localhost:3000/admin and sign in as `catalogue@talasey.local` / `talasey-demo`.

- **Orders**: the order is there with the delivery day (booked) and the lorry answers. Refund the delivery charge.
- **Products → Porcelain tile spacers**: change the price, add a photo with a description, **Save**. Open the product on the site: the new price and photo are there.
- **Change log**: every change, with **Put back as before**. Undo the price change.
- **Delivery**: zones, prices and how many pallet days are free.

## 5. Content (4 minutes)

Open http://localhost:3000/content.

- Sign in as `contributor@talasey.local`: start a guide, fill it in, **Save draft**. There is no publish button; the site doesn't show it.
- Sign out, sign in as `editor@talasey.local`, open the guide, **Preview the draft**, then **Save and publish**. It is on the site at `/guides/<its address>/`.
- Legal and finance wording can only be published by the owner.

## If Amy asks

- **"What does it cost to run?"** Two apps on Vercel and Railway, one Postgres and one Redis. No commerce or CMS subscriptions.
- **"Can we change things without a developer?"** Products, prices, photos, stock, delivery prices and days, pages, guides, FAQs, the homepage, menus, redirects and email wording are all in `/admin` and `/content`, and every change can be undone.
- **"When can we take real payments?"** When there's a Stripe account: two settings, no code.
