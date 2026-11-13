import { Inject, Injectable } from '@nestjs/common';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import type { Permission } from '../auth/roles.js';
import {
  AUDIT_LOG,
  type Actor,
  type AuditEntry,
  type AuditLog,
  type AuditQuery,
} from './audit-log.js';

// Each kind of audited thing knows how to put a snapshot back. A null snapshot means it did not
// exist at that point, so restoring removes it.
export interface Restorer<T = unknown> {
  subject: string;
  permission: Permission;
  restore(executor: Executor, subjectId: string, snapshot: T | null): Promise<string[]>;
  current(executor: Executor, subjectId: string): Promise<T | null>;
}

export type RestoreResult =
  | { status: 'restored'; entry: AuditEntry }
  | { status: 'not-found' }
  | { status: 'not-allowed' }
  | { status: 'invalid'; problems: string[] };

@Injectable()
export class AuditService {
  private readonly restorers = new Map<string, Restorer>();

  constructor(
    @Inject(AUDIT_LOG) private readonly log: AuditLog,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  register<T>(restorer: Restorer<T>) {
    this.restorers.set(restorer.subject, restorer as Restorer);
  }

  record<T>(
    executor: Executor,
    actor: Actor,
    entry: { subject: string; subjectId: string; label: string; before: T | null; after: T | null },
  ) {
    const action = entry.before === null ? 'create' : entry.after === null ? 'delete' : 'update';
    return this.log.record(executor, { ...entry, action }, actor);
  }

  list(query: AuditQuery) {
    return this.log.list(query);
  }

  subjectsFor(allowed: (permission: Permission) => boolean): string[] {
    return [...this.restorers.values()]
      .filter((restorer) => allowed(restorer.permission))
      .map((restorer) => restorer.subject);
  }

  // Puts back the state from before the chosen change, and logs that as a change of its own.
  async restore(
    id: string,
    actor: Actor,
    allowed: (permission: Permission) => boolean,
  ): Promise<RestoreResult> {
    const entry = await this.log.find(id);
    const restorer = entry && this.restorers.get(entry.subject);
    if (!entry || !restorer) return { status: 'not-found' };
    if (!allowed(restorer.permission)) return { status: 'not-allowed' };

    return this.db.transaction(async (tx) => {
      const current = await restorer.current(tx, entry.subjectId);
      const problems = await restorer.restore(tx, entry.subjectId, entry.before);
      if (problems && problems.length > 0) return { status: 'invalid', problems } as const;
      const restored = await this.log.record(
        tx,
        {
          subject: entry.subject,
          subjectId: entry.subjectId,
          label: entry.label,
          action: 'restore',
          before: current,
          after: entry.before,
        },
        actor,
      );
      return { status: 'restored', entry: restored } as const;
    });
  }
}
