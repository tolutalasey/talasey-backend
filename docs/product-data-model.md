# Product data model

Every product, whatever its page type, is the same records in the backend (`src/database/schema/catalogue.ts`): a category, the product, its options (variants, one per SKU), photos and, for 1B, a colour set. What the customer chooses is saved on the basket line next to the SKU.

| Table                  | Holds                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `category`             | The three categories and 13 ranges from the product master sheet, by handle                                                                                                    |
| `product`              | Name, handle (the URL), descriptions, brand, published, page type, stock mode, lead time, options (Size, Finish), colour rule, made-to-measure formula, the sheet's own fields |
| `variant`              | One SKU: title, SKU, option values, price in pence including VAT (empty until priced), weight, m² per pack, stock count                                                        |
| `product_image`        | Photos, in order, with alt text and size                                                                                                                                       |
| `colour_set`, `colour` | Named lists of colours with a screen hex value and an optional sample photo                                                                                                    |
| `colour_image`         | A photo of one size, finish and colour from the product's set                                                                                                                  |
| `audit_entry`          | Every change: what, who, and the whole state before and after                                                                                                                  |

## Stock modes

| Stock mode                  | What the shop does                                                   |
| --------------------------- | -------------------------------------------------------------------- |
| Stocked only                | Sells what is in the yard, then stops                                |
| Stocked, then made to order | Sells the yard first, then makes the rest: "12 now, 2 made to order" |
| Made to order               | Always available, after the lead time                                |

## Page types

| Type | What it is                                | How it's stored                                                                           |
| ---- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1A   | Every colour and size is its own SKU      | One variant per SKU                                                                       |
| 1B   | One page per design; SKU is size × finish | Variants for size × finish; a colour set with a rule such as "Finish is Powder coated"    |
| 2    | Made to measure                           | One base variant and a pricing formula ([0012](adr/0012-bespoke-prices-on-the-server.md)) |
| 3    | Enquiry only                              | Not sold online; the enquiry form                                                         |
| 4    | Build your own                            | Several real variants added as one build ([0013](adr/0013-builds-as-grouped-lines.md))    |

## SKU rules

Checked by `GET /admin/catalogue/sku-checks` and shown on each product in the admin:

- Every variant has a SKU, and no SKU is used twice.
- On page type 1B, colour is never a product option, and no SKU carries a colour code (PCAN, PCB, PCW). There is one PC SKU per size.
- Product and option names never contain product codes such as SCRDL1800.

## Search

The site builds its search index from the published products: title, handle, description, categories, options, lowest price, SKUs and availability. See [0024](adr/0024-search-behind-a-port.md).
