import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditAction = pgEnum('audit_action', ['create', 'update', 'delete', 'restore']);

// The whole state of the thing before and after each change, so any entry can be restored.
export const auditEntries = pgTable(
  'audit_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject: text('subject').notNull(),
    subjectId: text('subject_id').notNull(),
    label: text('label').notNull(),
    action: auditAction('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    actorId: uuid('actor_id'),
    actorName: text('actor_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_entry_subject_idx').on(table.subject, table.subjectId),
    index('audit_entry_created_idx').on(table.createdAt),
  ],
);
