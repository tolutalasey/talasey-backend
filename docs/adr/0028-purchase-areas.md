title: '0028 Product options are links, and colour sets come from the sheet',
};

# 0028 Product options are links, and colour sets come from the sheet

**Status:** Accepted, 13 November 2026

## Context

PRD section 10 has two standard page types: 1A, where every colour and size is its own SKU, and 1B, where the SKU is size and finish and the colour comes from a colour set. The product page has to open on `?colour=`, swap photos by option, show prices per pack and per m², and work without JavaScript. [0020](/adr/0020-checkout-without-javascript) left "Add to basket" errors needing JavaScript. The master sheet names a colour set on 20 products, but the importer didn't create the sets.

## Decision

- Each option value is a link to the page with that option chosen (`?size=`, `?finish=`, `?colour=`). The page opens on a priced option that can be bought; `?colour=` opens on that colour if it can be bought, otherwise the first colour in stock.
- For 1B, the colours show as radio-button swatches in the basket form. The choice goes on the basket line as metadata, and Medusa's add-to-basket hook refuses a line without a required colour or with one from outside the set.
- The importer reads the "Colour sets" block of the sheet's Formulas & colours tab, creates the sets (swatch shades from the RAL codes) and gives each product that names one a 1B profile. Products that already have a profile, and colours already in a set, are left as they are.
- Photos come from the product's content in Sanity, each tagged with the size, finish or colour it shows.
- The form feedback cookie from [0020](/adr/0020-checkout-without-javascript) now serves every form, so basket errors on product pages show without JavaScript too.
- "Complete the job" items are plain check boxes, never ticked, sent with the main item.

## Consequences

- Choosing an option is a page load. It is fast because products are cached, and it works everywhere.
- Product pages render per request (they read the query string and the feedback cookie).
- The RAL swatch shades are screen approximations; the catalogue team can change them in the admin.
- "Complete the job" quantities are one of each until the data says how much jointing or primer a pack of paving needs.
