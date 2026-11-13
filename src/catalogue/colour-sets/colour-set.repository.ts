import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Database, Executor } from '../../database/client.js';
import { DATABASE } from '../../database/database.module.js';
import { colourSets, colours, products } from '../../database/schema/index.js';

export interface ColourState {
  id?: string;
  name: string;
  hex: string;
  photoUrl: string | null;
}

export interface ColourSetState {
  name: string;
  colours: ColourState[];
}

export interface ColourSet extends ColourSetState {
  id: string;
  colours: (ColourState & { id: string })[];
  usedBy: number;
}

@Injectable()
export class ColourSetRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(executor: Executor = this.db, ids?: string[]): Promise<ColourSet[]> {
    const sets = await executor
      .select()
      .from(colourSets)
      .where(ids ? inArray(colourSets.id, ids) : undefined)
      .orderBy(asc(colourSets.name));
    if (sets.length === 0) return [];
    const setIds = sets.map((set) => set.id);
    const [colourRows, users] = await Promise.all([
      executor
        .select()
        .from(colours)
        .where(inArray(colours.setId, setIds))
        .orderBy(asc(colours.rank)),
      executor
        .select({ setId: products.colourSetId })
        .from(products)
        .where(inArray(products.colourSetId, setIds)),
    ]);
    return sets.map((set) => ({
      id: set.id,
      name: set.name,
      usedBy: users.filter((user) => user.setId === set.id).length,
      colours: colourRows
        .filter((colour) => colour.setId === set.id)
        .map(({ id, name, hex, photoUrl }) => ({ id, name, hex, photoUrl })),
    }));
  }

  async find(id: string, executor: Executor = this.db): Promise<ColourSet | null> {
    const [set] = await this.list(executor, [id]);
    return set ?? null;
  }

  async state(id: string, executor: Executor = this.db): Promise<ColourSetState | null> {
    const set = await this.find(id, executor);
    return set ? { name: set.name, colours: set.colours } : null;
  }

  // Colours keep their ids across edits, because colour photos and basket lines point at them.
  async save(executor: Executor, id: string, state: ColourSetState | null): Promise<void> {
    if (!state) {
      await executor.delete(colourSets).where(eq(colourSets.id, id));
      return;
    }
    await executor
      .insert(colourSets)
      .values({ id, name: state.name })
      .onConflictDoUpdate({ target: colourSets.id, set: { name: state.name } });

    const keep = state.colours.flatMap((colour) => (colour.id ? [colour.id] : []));
    const current = await executor
      .select({ id: colours.id })
      .from(colours)
      .where(eq(colours.setId, id));
    const removed = current.map((row) => row.id).filter((colourId) => !keep.includes(colourId));
    if (removed.length > 0) await executor.delete(colours).where(inArray(colours.id, removed));

    for (const [rank, colour] of state.colours.entries()) {
      const values = { name: colour.name, hex: colour.hex, photoUrl: colour.photoUrl, rank };
      if (colour.id) {
        await executor
          .insert(colours)
          .values({ ...values, id: colour.id, setId: id })
          .onConflictDoUpdate({ target: colours.id, set: values });
      } else {
        await executor.insert(colours).values({ ...values, setId: id });
      }
    }
  }
}
