import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const contentStatus = pgEnum('content_status', ['draft', 'published', 'changed']);

// One editable thing on the site: a page, guide, FAQ, the homepage, a redirect and so on. The
// draft is what editors work on; the published copy is what the site shows.
export const contentDocuments = pgTable(
  'content_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    key: text('key').notNull(),
    draft: jsonb('draft').$type<Record<string, unknown>>().notNull(),
    published: jsonb('published').$type<Record<string, unknown>>(),
    status: contentStatus('status').notNull().default('draft'),
    updatedBy: text('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedBy: text('published_by'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [index('content_document_type_idx').on(table.type, table.key)],
);
