import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { colours, variants } from './catalogue.js';
import { shipmentType } from './delivery.js';
import type { SampleItemRow } from './samples.js';

export interface AddressRow {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  postcode: string;
  phone: string;
}

export interface SlotChoiceRow {
  holdId: string;
  postcode: string;
  date: string;
  zone: string;
  status: 'held' | 'booked' | 'needs-rebooking';
}

export interface AccessAnswersRow {
  vehicleAccess: 'articulated' | 'rigid' | 'small';
  hardStanding: boolean;
  kerbsideOk: boolean;
}

export interface BespokeRow {
  unit: string;
  dimensions: Record<string, number>;
  choices: Record<string, string>;
  // How it reads to people, like "1200 × 400 × 500 mm, Powder coated". Older lines have none.
  summary?: string;
}

export interface BuildPartRow {
  quantity: number;
  side?: string;
}

export const baskets = pgTable('basket', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  address: jsonb('address').$type<AddressRow>(),
  shipment: shipmentType('shipment'),
  slot: jsonb('slot').$type<SlotChoiceRow>(),
  access: jsonb('access').$type<AccessAnswersRow>(),
  paymentReference: text('payment_reference'),
  promotionCode: text('promotion_code'),
  orderId: uuid('order_id'),
  samples: jsonb('samples').$type<SampleItemRow[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const basketLines = pgTable(
  'basket_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    basketId: uuid('basket_id')
      .notNull()
      .references(() => baskets.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    // Set for made-to-measure lines, which the server prices from the sizes when they are added.
    unitPricePence: integer('unit_price_pence'),
    colourId: uuid('colour_id').references(() => colours.id, { onDelete: 'cascade' }),
    buildId: text('build_id'),
    buildParts: jsonb('build_parts').$type<BuildPartRow[]>(),
    bespoke: jsonb('bespoke').$type<BespokeRow>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('basket_line_basket_idx').on(table.basketId)],
);

export interface OrderSampleRow extends SampleItemRow {
  pricePence: number;
}

export const orderStatus = pgEnum('order_status', ['placed', 'cancelled']);
export const paymentStatus = pgEnum('payment_status', ['paid', 'partly_refunded', 'refunded']);
export const paymentProvider = pgEnum('payment_provider', ['stripe', 'test']);

export const orders = pgTable(
  'order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: serial('number').notNull().unique(),
    basketId: uuid('basket_id').notNull().unique(),
    email: text('email').notNull(),
    address: jsonb('address').$type<AddressRow>().notNull(),
    shipment: shipmentType('shipment').notNull(),
    deliveryName: text('delivery_name').notNull(),
    itemTotalPence: integer('item_total_pence').notNull(),
    deliveryPence: integer('delivery_pence').notNull(),
    discountPence: integer('discount_pence').notNull().default(0),
    promotions: jsonb('promotions').$type<string[]>().notNull().default([]),
    totalPence: integer('total_pence').notNull(),
    slot: jsonb('slot').$type<SlotChoiceRow>(),
    access: jsonb('access').$type<AccessAnswersRow>(),
    status: orderStatus('status').notNull().default('placed'),
    paymentProvider: paymentProvider('payment_provider').notNull(),
    paymentReference: text('payment_reference').notNull(),
    paymentStatus: paymentStatus('payment_status').notNull().default('paid'),
    refundedPence: integer('refunded_pence').notNull().default(0),
    // Samples are kept apart from the products bought, for reporting and the right emails.
    samples: jsonb('samples').$type<OrderSampleRow[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('order_created_idx').on(table.createdAt)],
);

// What was bought, copied at the time, so later catalogue changes never alter an order.
export const orderLines = pgTable(
  'order_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id'),
    productTitle: text('product_title').notNull(),
    variantTitle: text('variant_title'),
    sku: text('sku'),
    colour: text('colour'),
    quantity: integer('quantity').notNull(),
    unitPricePence: integer('unit_price_pence').notNull(),
    totalPence: integer('total_pence').notNull(),
    stock: text('stock').notNull(),
    buildId: text('build_id'),
    buildParts: jsonb('build_parts').$type<BuildPartRow[]>(),
    bespoke: jsonb('bespoke').$type<BespokeRow>(),
  },
  (table) => [index('order_line_order_idx').on(table.orderId)],
);
