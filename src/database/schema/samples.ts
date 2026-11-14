import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './catalogue.js';
import type { AddressRow } from './orders.js';

// A free sample we offer for a product, such as one colour of a paving range.
export const sampleOffers = pgTable('sample_offer', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface SampleItemRow {
  offerId: string;
  productTitle: string;
  productHandle: string;
  label: string;
}

export const sampleRequestStatus = pgEnum('sample_request_status', ['new', 'dispatched']);

export const sampleRequests = pgTable('sample_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: serial('number').notNull().unique(),
  email: text('email').notNull(),
  address: jsonb('address').$type<AddressRow>().notNull(),
  items: jsonb('items').$type<SampleItemRow[]>().notNull(),
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  status: sampleRequestStatus('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  dispatchedBy: text('dispatched_by'),
});
