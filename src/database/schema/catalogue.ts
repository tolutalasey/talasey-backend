import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const stockMode = pgEnum('stock_mode', [
  'stocked',
  'made_to_order',
  'stocked_then_made_to_order',
]);

export const categories = pgTable('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: text('handle').notNull().unique(),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
});

export const colourSets = pgTable('colour_set', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const colours = pgTable(
  'colour',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    setId: uuid('set_id')
      .notNull()
      .references(() => colourSets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hex: text('hex').notNull(),
    photoUrl: text('photo_url'),
    rank: integer('rank').notNull().default(0),
  },
  (table) => [index('colour_set_idx').on(table.setId)],
);

export interface ProductOptionRow {
  title: string;
  values: string[];
}

export const products = pgTable('product', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: text('handle').notNull().unique(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  description: text('description'),
  brand: text('brand'),
  published: boolean('published').notNull().default(false),
  // PRD section 10: 1A, 1B, 2, 3 or 4. Null until someone sets the product up.
  pageType: text('page_type'),
  stockMode: stockMode('stock_mode').notNull().default('made_to_order'),
  leadTimeMinDays: integer('lead_time_min_days'),
  leadTimeMaxDays: integer('lead_time_max_days'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  options: jsonb('options').$type<ProductOptionRow[]>().notNull().default([]),
  colourSetId: uuid('colour_set_id').references(() => colourSets.id, { onDelete: 'restrict' }),
  colourOption: text('colour_option'),
  colourOptionValue: text('colour_option_value'),
  colourRequired: boolean('colour_required').notNull().default(true),
  colourLabel: text('colour_label'),
  bespoke: jsonb('bespoke'),
  attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
  pimSku: text('pim_sku'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const variants = pgTable(
  'variant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    title: text('title').notNull(),
    options: jsonb('options').$type<Record<string, string>>().notNull().default({}),
    // Including VAT, in pence. Null until someone prices it; unpriced variants can't be bought.
    pricePence: integer('price_pence'),
    weightKg: doublePrecision('weight_kg'),
    coverageM2: doublePrecision('coverage_m2'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    barcode: text('barcode'),
    rank: integer('rank').notNull().default(0),
  },
  (table) => [
    index('variant_product_idx').on(table.productId),
    index('variant_sku_idx').on(table.sku),
  ],
);

export const productImages = pgTable(
  'product_image',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    alt: text('alt').notNull(),
    width: integer('width'),
    height: integer('height'),
    rank: integer('rank').notNull().default(0),
  },
  (table) => [index('product_image_product_idx').on(table.productId)],
);

// A photo of one size and finish in one colour from the product's colour set (page type 1B).
export const colourImages = pgTable(
  'colour_image',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    colourId: uuid('colour_id').notNull(),
    size: text('size').notNull(),
    finish: text('finish').notNull(),
    url: text('url').notNull(),
    alt: text('alt').notNull(),
  },
  (table) => [index('colour_image_product_idx').on(table.productId)],
);
