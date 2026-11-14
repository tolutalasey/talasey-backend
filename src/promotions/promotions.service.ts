import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { isUniqueViolation } from '../database/errors.js';
import { promotions } from '../database/schema/index.js';
import {
  applyPromotions,
  normaliseCode,
  type Promotion,
  type PromotionOutcome,
} from './promotion-rules.js';

export type PromotionRow = typeof promotions.$inferSelect;

export interface PromotionInput {
  name: string;
  code: string | null;
  kind: Promotion['kind'];
  value: number;
  minSpendPence: number;
  startsAt: Date;
  endsAt: Date | null;
  maxUses: number | null;
  active: boolean;
}

export type PromotionChange =
  | { status: 'ok'; promotion: PromotionRow }
  | { status: 'not-found' }
  | { status: 'invalid'; problem: string };

function inputProblem(input: PromotionInput): string | null {
  if (input.kind === 'percent' && (input.value < 1 || input.value > 90))
    return 'A percentage off is between 1 and 90';
  if (input.kind === 'amount' && input.value < 1) return 'Enter how much to take off';
  if (input.endsAt && input.endsAt <= input.startsAt) return 'The end must be after the start';
  if (input.code !== null && !/^[A-Z0-9-]{3,20}$/.test(input.code))
    return 'Codes are 3 to 20 letters, numbers or hyphens';
  return null;
}

@Injectable()
export class PromotionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(): Promise<PromotionRow[]> {
    return this.db.select().from(promotions).orderBy(asc(promotions.name));
  }

  async price(
    basket: { itemsPence: number; deliveryPence: number; code: string | null },
    now: Date,
    executor: Executor = this.db,
  ): Promise<PromotionOutcome> {
    const all = await executor.select().from(promotions).where(eq(promotions.active, true));
    return applyPromotions(all, { ...basket, now });
  }

  // Counts a use of each code on the order, so a limited code runs out.
  async recordUse(executor: Executor, ids: string[]) {
    if (ids.length === 0) return;
    await executor
      .update(promotions)
      .set({ uses: sql`${promotions.uses} + 1` })
      .where(inArray(promotions.id, ids));
  }

  async create(input: PromotionInput, by: string): Promise<PromotionChange> {
    return this.save(input, async (values) => {
      const [row] = await this.db
        .insert(promotions)
        .values({ ...values, createdBy: by })
        .returning();
      return row ?? null;
    });
  }

  async update(id: string, input: PromotionInput): Promise<PromotionChange> {
    return this.save(input, async (values) => {
      const [row] = await this.db
        .update(promotions)
        .set(values)
        .where(eq(promotions.id, id))
        .returning();
      return row ?? null;
    });
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(promotions)
      .where(eq(promotions.id, id))
      .returning({ id: promotions.id });
    return rows.length > 0;
  }

  private async save(
    raw: PromotionInput,
    write: (values: PromotionInput) => Promise<PromotionRow | null>,
  ): Promise<PromotionChange> {
    const input = { ...raw, code: raw.code ? normaliseCode(raw.code) : null };
    const problem = inputProblem(input);
    if (problem) return { status: 'invalid', problem };
    try {
      const promotion = await write(input);
      return promotion ? { status: 'ok', promotion } : { status: 'not-found' };
    } catch (error) {
      if (isUniqueViolation(error))
        return { status: 'invalid', problem: 'Another promotion already uses that code' };
      throw error;
    }
  }
}
