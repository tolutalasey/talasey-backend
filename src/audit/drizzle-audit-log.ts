import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { auditEntries } from '../database/schema/index.js';
import type { Actor, AuditEntry, AuditLog, AuditQuery, NewAuditEntry } from './audit-log.js';

const columns = {
  id: auditEntries.id,
  subject: auditEntries.subject,
  subjectId: auditEntries.subjectId,
  label: auditEntries.label,
  action: auditEntries.action,
  before: auditEntries.before,
  after: auditEntries.after,
  actorName: auditEntries.actorName,
  createdAt: auditEntries.createdAt,
};

@Injectable()
export class DrizzleAuditLog implements AuditLog {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async record(executor: Executor, entry: NewAuditEntry, actor: Actor): Promise<AuditEntry> {
    const [row] = await executor
      .insert(auditEntries)
      .values({ ...entry, actorId: actor.id, actorName: actor.name })
      .returning(columns);
    if (!row) throw new Error('Audit entry was not recorded');
    return row;
  }

  list({ subjects, subjectId, limit }: AuditQuery): Promise<AuditEntry[]> {
    return this.db
      .select(columns)
      .from(auditEntries)
      .where(
        and(
          subjects ? inArray(auditEntries.subject, subjects) : undefined,
          subjectId ? eq(auditEntries.subjectId, subjectId) : undefined,
        ),
      )
      .orderBy(desc(auditEntries.createdAt))
      .limit(limit);
  }

  async find(id: string): Promise<AuditEntry | null> {
    const [row] = await this.db.select(columns).from(auditEntries).where(eq(auditEntries.id, id));
    return row ?? null;
  }
}
