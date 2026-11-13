import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { contentDocuments } from '../database/schema/index.js';

export type ContentDocument = typeof contentDocuments.$inferSelect;
export type ContentState = Pick<ContentDocument, 'type' | 'key' | 'draft' | 'published' | 'status'>;

@Injectable()
export class ContentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(type: string): Promise<ContentDocument[]> {
    return this.db
      .select()
      .from(contentDocuments)
      .where(eq(contentDocuments.type, type))
      .orderBy(asc(contentDocuments.key));
  }

  async find(id: string, executor: Executor = this.db): Promise<ContentDocument | null> {
    const [row] = await executor.select().from(contentDocuments).where(eq(contentDocuments.id, id));
    return row ?? null;
  }

  async findByKey(type: string, key: string, executor: Executor = this.db) {
    const [row] = await executor
      .select()
      .from(contentDocuments)
      .where(and(eq(contentDocuments.type, type), eq(contentDocuments.key, key)));
    return row ?? null;
  }

  async published(type: string): Promise<Record<string, unknown>[]> {
    const rows = await this.db
      .select({ published: contentDocuments.published })
      .from(contentDocuments)
      .where(and(eq(contentDocuments.type, type), isNotNull(contentDocuments.published)))
      .orderBy(asc(contentDocuments.key));
    return rows.flatMap((row) => (row.published ? [row.published] : []));
  }

  async write(
    executor: Executor,
    id: string,
    state: ContentState | null,
    by: { updatedBy: string; publishedBy?: string },
  ): Promise<void> {
    if (!state) {
      await executor.delete(contentDocuments).where(eq(contentDocuments.id, id));
      return;
    }
    const now = new Date();
    const values = {
      ...state,
      updatedBy: by.updatedBy,
      updatedAt: now,
      ...(by.publishedBy && { publishedBy: by.publishedBy, publishedAt: now }),
    };
    await executor
      .insert(contentDocuments)
      .values({ id, ...values })
      .onConflictDoUpdate({ target: contentDocuments.id, set: values });
  }
}
