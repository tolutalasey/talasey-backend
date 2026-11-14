import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const promotionKind = pgEnum('promotion_kind', ['percent', 'amount', 'free_delivery']);

// A discount code, or with no code, something that applies by itself: a sale across the shop or
// free delivery over a spend. Value is a percentage for "percent" and pence for "amount".
export const promotions = pgTable('promotion', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').unique(),
  kind: promotionKind('kind').notNull(),
  value: integer('value').notNull().default(0),
  minSpendPence: integer('min_spend_pence').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
