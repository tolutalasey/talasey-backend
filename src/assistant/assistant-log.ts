import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, isNotNull, lt, sql, sum } from 'drizzle-orm';
import { z } from 'zod';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { assistantExchanges } from '../database/schema/index.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import type {
  assistantUsageSchema,
  conversationSummarySchema,
  exchangeSchema,
  gapSchema,
} from './assistant.schemas.js';

const KEEP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const LISTED = 100;
const PRUNED_KEY = 'assistant:pruned';

export type NewExchange = typeof assistantExchanges.$inferInsert;
type Row = typeof assistantExchanges.$inferSelect;

const since = (days: number) => new Date(Date.now() - days * DAY_MS);

const toExchange = (row: Row): z.infer<typeof exchangeSchema> => ({
  id: row.id,
  page: row.page,
  question: row.question,
  hadPhoto: row.hadPhoto,
  reply: row.reply,
  products: row.products,
  gap: row.gap,
  handedOff: row.handedOff,
  failed: row.failed,
  createdAt: row.createdAt.toISOString(),
});

// What the chat said, kept for staff to read and to count the cost. Rows older than 90 days are
// removed once a day, the next time someone chats.
@Injectable()
export class AssistantLog {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async record(exchange: NewExchange): Promise<void> {
    await this.db.insert(assistantExchanges).values(exchange);
    if (await this.store.setIfAbsent(PRUNED_KEY, '1', DAY_MS)) {
      await this.db
        .delete(assistantExchanges)
        .where(lt(assistantExchanges.createdAt, since(KEEP_DAYS)));
    }
  }

  async usage(days: number): Promise<z.infer<typeof assistantUsageSchema>> {
    const [totals] = await this.db
      .select({
        messages: count(),
        conversations: sql<number>`count(distinct ${assistantExchanges.conversationId})`.mapWith(
          Number,
        ),
        gaps: sql<number>`count(${assistantExchanges.gap})`.mapWith(Number),
        handedOff: sql<number>`count(*) filter (where ${assistantExchanges.handedOff})`.mapWith(
          Number,
        ),
        failed: sql<number>`count(*) filter (where ${assistantExchanges.failed})`.mapWith(Number),
        inputTokens: sum(assistantExchanges.inputTokens).mapWith(Number),
        cachedTokens: sum(assistantExchanges.cachedTokens).mapWith(Number),
        outputTokens: sum(assistantExchanges.outputTokens).mapWith(Number),
      })
      .from(assistantExchanges)
      .where(gte(assistantExchanges.createdAt, since(days)));
    const tokens = {
      inputTokens: totals?.inputTokens ?? 0,
      cachedTokens: totals?.cachedTokens ?? 0,
      outputTokens: totals?.outputTokens ?? 0,
    };
    return {
      days,
      conversations: totals?.conversations ?? 0,
      messages: totals?.messages ?? 0,
      gaps: totals?.gaps ?? 0,
      handedOff: totals?.handedOff ?? 0,
      failed: totals?.failed ?? 0,
      ...tokens,
      costUsd: this.cost(tokens),
    };
  }

  async conversations(days: number): Promise<z.infer<typeof conversationSummarySchema>[]> {
    const id = assistantExchanges.conversationId;
    const rows = await this.db
      .select({
        id,
        startedAt: sql<Date>`min(${assistantExchanges.createdAt})`.mapWith(
          assistantExchanges.createdAt,
        ),
        lastAt: sql<Date>`max(${assistantExchanges.createdAt})`.mapWith(
          assistantExchanges.createdAt,
        ),
        messages: count(),
        firstQuestion: sql<string>`(array_agg(${assistantExchanges.question} order by ${assistantExchanges.createdAt}))[1]`,
        pages: sql<string[]>`array_remove(array_agg(distinct ${assistantExchanges.page}), null)`,
        photos: sql<number>`count(*) filter (where ${assistantExchanges.hadPhoto})`.mapWith(Number),
        gaps: sql<number>`count(${assistantExchanges.gap})`.mapWith(Number),
        handedOff: sql<boolean>`bool_or(${assistantExchanges.handedOff})`,
      })
      .from(assistantExchanges)
      .where(gte(assistantExchanges.createdAt, since(days)))
      .groupBy(id)
      .orderBy(desc(sql`max(${assistantExchanges.createdAt})`))
      .limit(LISTED);
    return rows.map((row) => ({
      ...row,
      startedAt: row.startedAt.toISOString(),
      lastAt: row.lastAt.toISOString(),
      pages: row.pages ?? [],
      handedOff: Boolean(row.handedOff),
    }));
  }

  async conversation(conversationId: string): Promise<z.infer<typeof exchangeSchema>[]> {
    const rows = await this.db
      .select()
      .from(assistantExchanges)
      .where(eq(assistantExchanges.conversationId, conversationId))
      .orderBy(asc(assistantExchanges.createdAt));
    return rows.map(toExchange);
  }

  async gaps(days: number): Promise<z.infer<typeof gapSchema>[]> {
    const rows = await this.db
      .select()
      .from(assistantExchanges)
      .where(and(gte(assistantExchanges.createdAt, since(days)), isNotNull(assistantExchanges.gap)))
      .orderBy(desc(assistantExchanges.createdAt))
      .limit(LISTED);
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      page: row.page,
      question: row.question,
      gap: row.gap,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private cost(tokens: { inputTokens: number; cachedTokens: number; outputTokens: number }) {
    const input = this.config.ASSISTANT_USD_PER_MTOK_INPUT;
    const output = this.config.ASSISTANT_USD_PER_MTOK_OUTPUT;
    if (input === undefined || output === undefined) return null;
    const cached = this.config.ASSISTANT_USD_PER_MTOK_CACHED ?? input;
    const total =
      (tokens.inputTokens * input + tokens.cachedTokens * cached + tokens.outputTokens * output) /
      1_000_000;
    return Math.round(total * 100) / 100;
  }
}
