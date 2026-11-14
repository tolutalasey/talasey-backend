import { index, pgTable, timestamp, uniqueIndex, uuid, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { variants } from './catalogue.js';

// "Email me when it's back": one per person and option, until the email goes out.
export const stockAlerts = pgTable(
  'stock_alert',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('stock_alert_waiting_idx')
      .on(table.variantId, table.email)
      .where(sql`${table.notifiedAt} is null`),
    index('stock_alert_variant_idx').on(table.variantId),
  ],
);
