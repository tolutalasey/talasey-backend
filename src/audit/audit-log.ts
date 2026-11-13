import type { Executor } from '../database/client.js';

export type AuditAction = 'create' | 'update' | 'delete' | 'restore';

export interface Actor {
  id: string | null;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { id: null, name: 'System' };

export interface NewAuditEntry<T = unknown> {
  subject: string;
  subjectId: string;
  label: string;
  action: AuditAction;
  before: T | null;
  after: T | null;
}

export interface AuditEntry<T = unknown> extends NewAuditEntry<T> {
  id: string;
  actorName: string;
  createdAt: Date;
}

export interface AuditQuery {
  subjects?: string[];
  subjectId?: string;
  limit: number;
}

export interface AuditLog {
  record(executor: Executor, entry: NewAuditEntry, actor: Actor): Promise<AuditEntry>;
  list(query: AuditQuery): Promise<AuditEntry[]>;
  find(id: string): Promise<AuditEntry | null>;
}

export const AUDIT_LOG = Symbol('AuditLog');
