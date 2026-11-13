import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Database, Executor } from '../../database/client.js';
import { DATABASE } from '../../database/database.module.js';
import { isUniqueViolation } from '../../database/errors.js';
import type { Actor } from '../../audit/audit-log.js';
import { AuditService } from '../../audit/audit.service.js';
import { colourSetProblems } from '../rules/snapshot-checks.js';
import { CatalogueChanges } from '../catalogue-changes.service.js';
import {
  ColourSetRepository,
  type ColourSet,
  type ColourSetState,
} from './colour-set.repository.js';

const SUBJECT = 'colour_set';

export type ColourSetResult =
  | { status: 'saved'; set: ColourSet }
  | { status: 'not-found' }
  | { status: 'invalid'; problems: string[] }
  | { status: 'in-use'; usedBy: number };

const problemsOf = (state: ColourSetState) =>
  colourSetProblems({
    name: state.name,
    colours: state.colours.map((colour) => ({ ...colour, photo_url: colour.photoUrl })),
  });

@Injectable()
export class ColourSetService implements OnModuleInit {
  constructor(
    private readonly sets: ColourSetRepository,
    private readonly audit: AuditService,
    private readonly changes: CatalogueChanges,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  onModuleInit() {
    this.audit.register<ColourSetState>({
      subject: SUBJECT,
      permission: 'catalogue',
      current: (executor, id) => this.sets.state(id, executor),
      restore: async (executor, id, state) => {
        if (!state) {
          const set = await this.sets.find(id, executor);
          if (set && set.usedBy > 0) return [`${set.name} is used by ${set.usedBy} products`];
        } else {
          const problems = problemsOf(state);
          if (problems.length > 0) return problems;
        }
        await this.sets.save(executor, id, state);
        await this.changes.changed();
        return [];
      },
    });
  }

  list() {
    return this.sets.list();
  }

  find(id: string) {
    return this.sets.find(id);
  }

  create(state: ColourSetState, actor: Actor) {
    return this.write(randomUUID(), state, actor, true);
  }

  update(id: string, state: ColourSetState, actor: Actor) {
    return this.write(id, state, actor, false);
  }

  async remove(id: string, actor: Actor): Promise<ColourSetResult> {
    const set = await this.sets.find(id);
    if (!set) return { status: 'not-found' };
    if (set.usedBy > 0) return { status: 'in-use', usedBy: set.usedBy };
    await this.db.transaction(async (tx) => {
      await this.sets.save(tx, id, null);
      await this.log(tx, actor, id, set.name, { name: set.name, colours: set.colours }, null);
    });
    await this.changes.changed();
    return { status: 'saved', set };
  }

  private async write(
    id: string,
    state: ColourSetState,
    actor: Actor,
    isNew: boolean,
  ): Promise<ColourSetResult> {
    const problems = problemsOf(state);
    if (problems.length > 0) return { status: 'invalid', problems };
    try {
      const saved = await this.db.transaction(async (tx) => {
        const before = isNew ? null : await this.sets.state(id, tx);
        if (!isNew && !before) return null;
        await this.sets.save(tx, id, state);
        const after = await this.sets.state(id, tx);
        await this.log(tx, actor, id, state.name, before, after);
        return this.sets.find(id, tx);
      });
      if (!saved) return { status: 'not-found' };
      await this.changes.changed();
      return { status: 'saved', set: saved };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          status: 'invalid',
          problems: [`There is already a colour set called ${state.name}`],
        };
      }
      throw error;
    }
  }

  private log(
    executor: Executor,
    actor: Actor,
    id: string,
    label: string,
    before: ColourSetState | null,
    after: ColourSetState | null,
  ) {
    return this.audit.record(executor, actor, {
      subject: SUBJECT,
      subjectId: id,
      label,
      before,
      after,
    });
  }
}
