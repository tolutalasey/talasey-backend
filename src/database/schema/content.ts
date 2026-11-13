import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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

export const releaseStatus = pgEnum('content_release_status', [
  'open',
  'scheduled',
  'published',
  'failed',
]);

// Changes that go live together: a sale's pages, banners and FAQs, for example. A release
// publishes the current draft of each document in it, all or none, now or at a set time.
export const contentReleases = pgTable('content_release', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: releaseStatus('status').notNull().default('open'),
  publishAt: timestamp('publish_at', { withTimezone: true }),
  scheduledById: uuid('scheduled_by_id'),
  scheduledBy: text('scheduled_by'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  problems: jsonb('problems').$type<string[]>().notNull().default([]),
});

export const contentReleaseItems = pgTable(
  'content_release_item',
  {
    releaseId: uuid('release_id')
      .notNull()
      .references(() => contentReleases.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => contentDocuments.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.documentId] })],
);
