import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import type { Actor } from '../audit/audit-log.js';
import { AuditService } from '../audit/audit.service.js';
import { can, type StaffRole } from '../auth/roles.js';
import { SiteRefresh } from '../site/site-refresh.service.js';
import { contentType, keyOf, problemsOf, type ContentType } from './content-types.js';
import {
  ContentRepository,
  type ContentDocument,
  type ContentState,
} from './content.repository.js';

const SUBJECT = 'content';

export interface Editor extends Actor {
  id: string;
  role: StaffRole;
}

export type ContentResult =
  | { status: 'saved'; document: ContentDocument; problems: string[] }
  | { status: 'not-found' }
  | { status: 'not-allowed'; problem: string }
  | { status: 'invalid'; problems: string[] };

const notAllowed = (problem: string): ContentResult => ({ status: 'not-allowed', problem });

export const canPublish = (definition: ContentType, role: StaffRole) =>
  definition.locked ? role === 'owner' : can(role, 'content.publish');

@Injectable()
export class ContentService implements OnModuleInit {
  constructor(
    private readonly documents: ContentRepository,
    private readonly audit: AuditService,
    private readonly site: SiteRefresh,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  onModuleInit() {
    this.audit.register<ContentState>({
      subject: SUBJECT,
      permission: 'content.publish',
      current: async (executor, id) => {
        const document = await this.documents.find(id, executor);
        return document && this.stateOf(document);
      },
      restore: async (executor, id, state) => {
        await this.documents.write(executor, id, state, { updatedBy: 'Restored from the log' });
        if (state) await this.site.refresh([`content:${state.type}`]);
        return [];
      },
    });
  }

  list(type: string) {
    return this.documents.list(type);
  }

  find(id: string) {
    return this.documents.find(id);
  }

  published(type: string) {
    return this.documents.published(type);
  }

  // Drafts save even when they are not finished; the problems come back so the editor can see
  // what to fix before publishing.
  async create(
    type: string,
    data: Record<string, unknown>,
    editor: Editor,
  ): Promise<ContentResult> {
    const definition = contentType(type);
    if (!definition) return { status: 'not-found' };
    const key = keyOf(definition, data) || `untitled-${randomUUID().slice(0, 8)}`;
    if (await this.documents.findByKey(type, key)) {
      return { status: 'invalid', problems: [this.taken(definition, key)] };
    }
    return this.change(
      randomUUID(),
      editor,
      () => ({ state: { type, key, draft: data, published: null, status: 'draft' } }),
      { isNew: true },
    );
  }

  async saveDraft(
    id: string,
    data: Record<string, unknown>,
    editor: Editor,
  ): Promise<ContentResult> {
    return this.change(id, editor, async (current, definition, tx) => {
      const key = keyOf(definition, data) || current.key;
      const other = await this.documents.findByKey(current.type, key, tx);
      if (other && other.id !== id) return [this.taken(definition, key)];
      return {
        state: {
          ...this.stateOf(current),
          key,
          draft: data,
          status: current.published ? 'changed' : 'draft',
        },
      };
    });
  }

  // With `within`, the publish joins a bigger transaction (a release) and the caller refreshes
  // the site once everything in it is live.
  async publish(id: string, editor: Editor, within?: Executor): Promise<ContentResult> {
    return this.change(
      id,
      editor,
      (current, definition) => {
        if (!canPublish(definition, editor.role)) {
          return definition.locked
            ? 'Only the owner publishes legal and finance wording'
            : 'Contributors save drafts; an editor publishes them';
        }
        const parsed = definition.schema.safeParse(current.draft);
        if (!parsed.success) return problemsOf(definition, current.draft);
        return {
          state: {
            ...this.stateOf(current),
            published: parsed.data as Record<string, unknown>,
            status: 'published',
          },
          published: true,
        };
      },
      { within },
    );
  }

  async unpublish(id: string, editor: Editor): Promise<ContentResult> {
    return this.change(id, editor, (current, definition) => {
      if (!canPublish(definition, editor.role))
        return 'Only an editor can take content off the site';
      return { state: { ...this.stateOf(current), published: null, status: 'draft' } };
    });
  }

  async remove(id: string, editor: Editor): Promise<ContentResult> {
    return this.change(id, editor, (current, definition) => {
      if (!canPublish(definition, editor.role)) return 'Only an editor can delete content';
      return { state: null };
    });
  }

  private async change(
    id: string,
    editor: Editor,
    decide: (
      current: ContentDocument,
      definition: ContentType,
      tx: Executor,
    ) =>
      | { state: ContentState | null; published?: boolean }
      | string
      | string[]
      | Promise<{ state: ContentState | null; published?: boolean } | string | string[]>,
    { isNew = false, within }: { isNew?: boolean; within?: Executor } = {},
  ): Promise<ContentResult> {
    const run = async (tx: Executor): Promise<ContentResult> => {
      const existing = await this.documents.find(id, tx);
      const definition = contentType(existing?.type ?? '');
      if (!isNew && (!existing || !definition)) return { status: 'not-found' };
      const decision = await decide(existing as ContentDocument, definition as ContentType, tx);
      if (typeof decision === 'string') return notAllowed(decision);
      if (Array.isArray(decision)) return { status: 'invalid', problems: decision };
      const before = existing && this.stateOf(existing);
      const label = String(
        decision.state?.draft.title ??
          decision.state?.draft.name ??
          decision.state?.key ??
          existing?.key ??
          id,
      );
      await this.documents.write(tx, id, decision.state, {
        updatedBy: editor.name,
        ...(decision.published && { publishedBy: editor.name }),
      });
      await this.audit.record(tx, editor, {
        subject: SUBJECT,
        subjectId: id,
        label: `${contentType(decision.state?.type ?? existing?.type ?? '')?.label ?? 'Content'}: ${label}`,
        before,
        after: decision.state,
      });
      const document = await this.documents.find(id, tx);
      if (!document)
        return { status: 'saved', document: existing as ContentDocument, problems: [] };
      const saved = contentType(document.type);
      return {
        status: 'saved',
        document,
        problems: saved ? problemsOf(saved, document.draft) : [],
      };
    };
    const result = await (within ?? this.db).transaction(run);
    if (result.status === 'saved' && !within)
      await this.site.refresh([`content:${result.document.type}`]);
    return result;
  }

  private stateOf(document: ContentDocument): ContentState {
    return {
      type: document.type,
      key: document.key,
      draft: document.draft,
      published: document.published,
      status: document.status,
    };
  }

  private taken(definition: ContentType, key: string) {
    return definition.singleton
      ? `There is already a ${definition.label.toLowerCase()}`
      : `Another ${definition.label.toLowerCase()} entry already uses ${key}`;
  }
}
