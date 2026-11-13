# Choosing a PIM

For Amy. This page compares four product information systems (PIMs) so we can pick one, or decide to stay on the spreadsheet for now.

## Where we are

All product information lives in the product master sheet. I've built an importer that reads it into the shop: from the 590 rows it creates 171 products (54 with options such as size and finish, 117 single products) with 437 product codes. 153 rows are held back with a reason, mostly fence and trellis kits and pergolas waiting for the build-your-own page, and rows with no product code. 301 product codes have no price yet, so those products stay as drafts.

The importer is built so the spreadsheet can be swapped for a PIM later. Moving to a PIM means writing one new connector. Nothing else in the shop changes.

## What a PIM would give us

- One place where the team edits product details, photos and specifications, with checks before anything goes live.
- Changes reach the website without anyone exporting a spreadsheet.
- The same information can feed Google Shopping, marketplaces and trade price lists.

## The question that matters most

When someone changes a product, how does the website find out? There are three ways:

- **It tells us straight away about that product.** The site updates within a minute or so.
- **It tells us when a batch is published.** The site updates when someone publishes a channel, not per product.
- **We ask it on a schedule**, for example every 15 minutes. Simple, but changes wait for the next check.

## Comparison

| PIM     | How the website hears about changes                                                                                     | Which plans                                                         | What it means for us                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Akeneo  | Sends a message as each product changes. The message only names the product, so the site then fetches the full details. | Hosted (SaaS) editions, including Growth                            | Closest to real time. Needs a paid hosted plan.                                                            |
| Salsify | Sends a message when a channel is published.                                                                            | Not confirmed                                                       | Batch updates. I could not confirm this from Salsify's public documents, so we would need to ask them.     |
| Pimcore | We can read products at any time in every edition (its GraphQL Datahub). Messages on changes are Enterprise only.       | Reading: all editions, including the free one. Messages: Enterprise | Free to start, but on the free edition the site has to check on a schedule. We would also have to host it. |
| Plytix  | Sends a message each time a channel is processed, not for each product.                                                 | Not checked                                                         | Batch updates, timed by the channel.                                                                       |

I haven't compared prices: none of the four publishes a full price list for our size, so we need quotes.

## What I'd suggest

1. Launch on the spreadsheet. The importer already handles it, and it lets us fix the missing prices and codes first.
2. Decide how quickly product changes must show on the site. If "within a minute" matters, Akeneo is the best fit. If "within the hour" is fine, Plytix or Pimcore with a scheduled check will do.
3. Ask Akeneo, Plytix and Salsify for quotes and a demo with ten of our real products, including a screen with options and a bespoke planter.

## Decisions for you

- How fast must a product change reach the website?
- Is there a budget for a hosted PIM, or should we look at the free Pimcore edition that we host ourselves?
- Who on the team will own product data day to day?
