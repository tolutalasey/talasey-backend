import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, lte, ne } from 'drizzle-orm';
import { STAFF_USER_REPOSITORY, type StaffUserRepository } from '../auth/staff-user.repository.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import {
  contentDocuments,
  contentReleaseItems,
  contentReleases,
} from '../database/schema/index.js';
import { SiteRefresh } from '../site/site-refresh.service.js';
import { contentType } from './content-types.js';
import { canPublish, ContentService, type Editor } from './content.service.js';

export type Release = typeof contentReleases.$inferSelect;

export interface ReleaseItem {
  documentId: string;
  type: string;
  key: string;
  title: string;
}

export type ReleaseWithItems = Release & { items: ReleaseItem[] };

export type ReleaseResult =
  | { status: 'ok'; release: ReleaseWithItems }
  | { status: 'not-found' }
  | { status: 'not-allowed'; problem: string }
  | { status: 'invalid'; problems: string[] };

class ReleaseFailed extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
  }
}

const notAllowed = (problem: string): ReleaseResult => ({ status: 'not-allowed', problem });

@Injectable()
export class ReleaseService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STAFF_USER_REPOSITORY) private readonly users: StaffUserRepository,
    private readonly content: ContentService,
    private readonly site: SiteRefresh,
  ) {}

  async list(): Promise<ReleaseWithItems[]> {
    const releases = await this.db
      .select()
      .from(contentReleases)
      .orderBy(asc(contentReleases.status), desc(contentReleases.createdAt));
    return Promise.all(releases.map((release) => this.withItems(release)));
  }

  async find(id: string): Promise<ReleaseWithItems | null> {
    const [release] = await this.db
      .select()
      .from(contentReleases)
      .where(eq(contentReleases.id, id));
    return release ? this.withItems(release) : null;
  }

  // The open or scheduled release a document is waiting in, if any.
  async releaseOf(documentId: string): Promise<Release | null> {
    const [row] = await this.db
      .select({ release: contentReleases })
      .from(contentReleaseItems)
      .innerJoin(contentReleases, eq(contentReleases.id, contentReleaseItems.releaseId))
      .where(
        and(
          eq(contentReleaseItems.documentId, documentId),
          ne(contentReleases.status, 'published'),
        ),
      );
    return row?.release ?? null;
  }

  async create(name: string, editor: Editor): Promise<ReleaseResult> {
    const [release] = await this.db
      .insert(contentReleases)
      .values({ name, createdBy: editor.name })
      .returning({ id: contentReleases.id });
    return release ? this.ok(release.id) : { status: 'not-found' };
  }

  async addDocument(id: string, documentId: string, editor: Editor): Promise<ReleaseResult> {
    return this.whileEditable(id, async () => {
      const [document] = await this.db
        .select()
        .from(contentDocuments)
        .where(eq(contentDocuments.id, documentId));
      const definition = contentType(document?.type ?? '');
      if (!document || !definition) return { status: 'not-found' };
      if (!canPublish(definition, editor.role))
        return notAllowed(`Only the owner can schedule ${definition.label.toLowerCase()}`);
      const waiting = await this.releaseOf(documentId);
      if (waiting && waiting.id !== id)
        return { status: 'invalid', problems: [`It is already in "${waiting.name}"`] };
      await this.db
        .insert(contentReleaseItems)
        .values({ releaseId: id, documentId })
        .onConflictDoNothing();
      return this.reopen(id);
    });
  }

  async removeDocument(id: string, documentId: string): Promise<ReleaseResult> {
    return this.whileEditable(id, async () => {
      await this.db
        .delete(contentReleaseItems)
        .where(
          and(
            eq(contentReleaseItems.releaseId, id),
            eq(contentReleaseItems.documentId, documentId),
          ),
        );
      return this.reopen(id);
    });
  }

  async schedule(id: string, publishAt: Date, editor: Editor, now: Date): Promise<ReleaseResult> {
    if (publishAt <= now)
      return { status: 'invalid', problems: ['Pick a time in the future, or publish it now'] };
    return this.whileEditable(id, async (release) => {
      if (release.items.length === 0)
        return { status: 'invalid', problems: ['Add something to the release first'] };
      await this.db
        .update(contentReleases)
        .set({
          status: 'scheduled',
          publishAt,
          scheduledById: editor.id,
          scheduledBy: editor.name,
          problems: [],
        })
        .where(eq(contentReleases.id, id));
      return this.ok(id);
    });
  }

  async unschedule(id: string): Promise<ReleaseResult> {
    return this.whileEditable(id, () => this.reopen(id));
  }

  async remove(id: string): Promise<ReleaseResult> {
    return this.whileEditable(id, async (release) => {
      await this.db.delete(contentReleases).where(eq(contentReleases.id, id));
      return { status: 'ok', release };
    });
  }

  async publishNow(id: string, editor: Editor, now: Date): Promise<ReleaseResult> {
    return this.whileEditable(id, async (release) => {
      if (release.items.length === 0)
        return { status: 'invalid', problems: ['Add something to the release first'] };
      const problems = await this.publish(release, editor, now);
      return problems.length ? { status: 'invalid', problems } : this.ok(id);
    });
  }

  // Publishes every scheduled release whose time has come, as the person who scheduled it.
  // Returns how many went live.
  async publishDue(now: Date): Promise<number> {
    const due = await this.db
      .select()
      .from(contentReleases)
      .where(and(eq(contentReleases.status, 'scheduled'), lte(contentReleases.publishAt, now)));
    let published = 0;
    for (const row of due) {
      const release = await this.withItems(row);
      const scheduler = row.scheduledById ? await this.users.findById(row.scheduledById) : null;
      const problems = scheduler?.active
        ? await this.publish(release, scheduler, now)
        : [`${row.scheduledBy ?? 'The person who scheduled it'} can no longer sign in`];
      if (problems.length) await this.fail(row.id, problems);
      else published += 1;
    }
    return published;
  }

  // All or nothing: one document that can't be published stops the whole release.
  private async publish(release: ReleaseWithItems, editor: Editor, now: Date): Promise<string[]> {
    try {
      await this.db.transaction(async (tx) => {
        for (const item of release.items) {
          const result = await this.content.publish(item.documentId, editor, tx);
          if (result.status === 'invalid')
            throw new ReleaseFailed(result.problems.map((problem) => `${item.title}: ${problem}`));
          if (result.status !== 'saved')
            throw new ReleaseFailed([
              `${item.title}: ${result.status === 'not-allowed' ? result.problem : 'it was deleted'}`,
            ]);
        }
        await tx
          .update(contentReleases)
          .set({ status: 'published', publishedAt: now, problems: [] })
          .where(eq(contentReleases.id, release.id));
      });
    } catch (error) {
      if (error instanceof ReleaseFailed) return error.problems;
      throw error;
    }
    await this.site.refresh([...new Set(release.items.map((item) => `content:${item.type}`))]);
    return [];
  }

  private async fail(id: string, problems: string[]) {
    await this.db
      .update(contentReleases)
      .set({ status: 'failed', problems })
      .where(eq(contentReleases.id, id));
  }

  // Any change takes a scheduled release back to open, so nothing goes live that wasn't seen
  // in its final state when it was scheduled.
  private async reopen(id: string): Promise<ReleaseResult> {
    await this.db
      .update(contentReleases)
      .set({
        status: 'open',
        publishAt: null,
        scheduledById: null,
        scheduledBy: null,
        problems: [],
      })
      .where(eq(contentReleases.id, id));
    return this.ok(id);
  }

  private async whileEditable(
    id: string,
    act: (release: ReleaseWithItems) => Promise<ReleaseResult>,
  ): Promise<ReleaseResult> {
    const release = await this.find(id);
    if (!release) return { status: 'not-found' };
    if (release.status === 'published')
      return notAllowed('That release is already live. Start a new one.');
    return act(release);
  }

  private async ok(id: string): Promise<ReleaseResult> {
    const release = await this.find(id);
    return release ? { status: 'ok', release } : { status: 'not-found' };
  }

  private async withItems(release: Release): Promise<ReleaseWithItems> {
    const rows = await this.db
      .select({ document: contentDocuments })
      .from(contentReleaseItems)
      .innerJoin(contentDocuments, eq(contentDocuments.id, contentReleaseItems.documentId))
      .where(eq(contentReleaseItems.releaseId, release.id))
      .orderBy(asc(contentDocuments.type), asc(contentDocuments.key));
    const items = rows.map(({ document }) => ({
      documentId: document.id,
      type: document.type,
      key: document.key,
      title: String(
        document.draft.title ?? document.draft.name ?? document.draft.question ?? document.key,
      ),
    }));
    return { ...release, items };
  }
}
