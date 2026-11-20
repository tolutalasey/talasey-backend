import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Messages from the contact form and site survey requests from enquiry-only products. Kept here
// so none is lost, as well as emailed to the enquiries inbox.
export const enquiries = pgTable(
  'enquiry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    postcode: text('postcode'),
    productHandle: text('product_handle'),
    productTitle: text('product_title'),
    topic: text('topic'),
    message: text('message'),
    answers: jsonb('answers').$type<Record<string, string>>().notNull().default({}),
    photos: jsonb('photos').$type<string[]>().notNull().default([]),
    consent: boolean('consent').notNull().default(false),
    status: text('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('enquiry_created_idx').on(table.createdAt)],
);
