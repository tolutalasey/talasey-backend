import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Each exchange in the site chat: the visitor's message, Tala's reply and what it cost, so staff
// can read conversations, see what it couldn't answer and keep an eye on the bill. Kept 90 days.
export const assistantExchanges = pgTable(
  'assistant_exchange',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull(),
    page: text('page'),
    question: text('question').notNull(),
    hadPhoto: boolean('had_photo').notNull().default(false),
    reply: text('reply'),
    products: jsonb('products').$type<string[]>().notNull().default([]),
    // Set when Tala couldn't answer from what it knows: what was missing.
    gap: text('gap'),
    handedOff: boolean('handed_off').notNull().default(false),
    failed: boolean('failed').notNull().default(false),
    inputTokens: integer('input_tokens').notNull().default(0),
    cachedTokens: integer('cached_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('assistant_exchange_created_idx').on(table.createdAt),
    index('assistant_exchange_conversation_idx').on(table.conversationId),
  ],
);
