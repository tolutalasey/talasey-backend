import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, inArray, ne, or, type SQL } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import {
  deliverySlotHolds,
  deliverySlots,
  deliverySlotSettings,
} from '../database/schema/index.js';
import type {
  ConfirmOutcome,
  HoldOutcome,
  NewSlotHold,
  SlotHold,
  SlotRepository,
  SlotSettings,
} from './slot.repository.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const holdColumns = {
  id: deliverySlotHolds.id,
  zone: deliverySlotHolds.zone,
  date: deliverySlotHolds.date,
  reference: deliverySlotHolds.reference,
  status: deliverySlotHolds.status,
  expiresAt: deliverySlotHolds.expiresAt,
};

function takes(now: Date): SQL | undefined {
  return or(
    eq(deliverySlotHolds.status, 'booked'),
    and(eq(deliverySlotHolds.status, 'held'), gt(deliverySlotHolds.expiresAt, now)),
  );
}

@Injectable()
export class DrizzleSlotRepository implements SlotRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findSettings(zone: string): Promise<SlotSettings | null> {
    const [row] = await this.db
      .select({
        zone: deliverySlotSettings.zone,
        palletsPerDay: deliverySlotSettings.palletsPerDay,
        leadTimeDays: deliverySlotSettings.leadTimeDays,
        sample: deliverySlotSettings.sample,
      })
      .from(deliverySlotSettings)
      .where(eq(deliverySlotSettings.zone, zone));
    return row ?? null;
  }

  async countTaken(zone: string, dates: string[], now: Date): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ date: deliverySlotHolds.date, taken: count() })
      .from(deliverySlotHolds)
      .where(
        and(eq(deliverySlotHolds.zone, zone), inArray(deliverySlotHolds.date, dates), takes(now)),
      )
      .groupBy(deliverySlotHolds.date);
    return new Map(rows.map((row) => [row.date, row.taken]));
  }

  async hold(input: NewSlotHold): Promise<HoldOutcome> {
    return this.db.transaction(async (tx) => {
      const capacity = await this.lockSlot(tx, input.zone, input.date, input.capacity);
      const taken = await this.taken(tx, input.zone, input.date, input.now, {
        reference: input.reference,
      });
      if (taken >= capacity) return { status: 'full' } as const;

      await tx
        .update(deliverySlotHolds)
        .set({ status: 'released' })
        .where(
          and(
            eq(deliverySlotHolds.reference, input.reference),
            eq(deliverySlotHolds.status, 'held'),
          ),
        );

      const [hold] = await tx
        .insert(deliverySlotHolds)
        .values({
          zone: input.zone,
          date: input.date,
          reference: input.reference,
          expiresAt: input.expiresAt,
        })
        .returning(holdColumns);
      return { status: 'held', hold: hold as SlotHold } as const;
    });
  }

  async confirm(id: string, now: Date): Promise<ConfirmOutcome> {
    const existing = await this.findHold(id);
    if (!existing) return { status: 'not-found' };

    return this.db.transaction(async (tx) => {
      const [slot] = await tx
        .select({ capacity: deliverySlots.capacity })
        .from(deliverySlots)
        .where(and(eq(deliverySlots.zone, existing.zone), eq(deliverySlots.date, existing.date)))
        .for('update');
      const [hold] = await tx
        .select(holdColumns)
        .from(deliverySlotHolds)
        .where(eq(deliverySlotHolds.id, id))
        .for('update');

      if (!slot || !hold) return { status: 'not-found' } as const;
      if (hold.status === 'booked') return { status: 'booked', hold } as const;
      if (hold.status === 'released') return { status: 'released' } as const;

      if (hold.expiresAt <= now) {
        const taken = await this.taken(tx, hold.zone, hold.date, now, { id });
        if (taken >= slot.capacity) return { status: 'full' } as const;
      }

      const [booked] = await tx
        .update(deliverySlotHolds)
        .set({ status: 'booked' })
        .where(eq(deliverySlotHolds.id, id))
        .returning(holdColumns);
      return { status: 'booked', hold: booked as SlotHold } as const;
    });
  }

  async release(id: string): Promise<SlotHold | null> {
    const [hold] = await this.db
      .update(deliverySlotHolds)
      .set({ status: 'released' })
      .where(and(eq(deliverySlotHolds.id, id), eq(deliverySlotHolds.status, 'held')))
      .returning(holdColumns);
    return hold ?? (await this.findHold(id));
  }

  async findHold(id: string): Promise<SlotHold | null> {
    const [hold] = await this.db
      .select(holdColumns)
      .from(deliverySlotHolds)
      .where(eq(deliverySlotHolds.id, id));
    return hold ?? null;
  }

  private async lockSlot(tx: Transaction, zone: string, date: string, capacity: number) {
    await tx.insert(deliverySlots).values({ zone, date, capacity }).onConflictDoNothing();
    const [slot] = await tx
      .select({ capacity: deliverySlots.capacity })
      .from(deliverySlots)
      .where(and(eq(deliverySlots.zone, zone), eq(deliverySlots.date, date)))
      .for('update');
    return slot?.capacity ?? capacity;
  }

  private async taken(
    tx: Transaction,
    zone: string,
    date: string,
    now: Date,
    exclude: { id?: string; reference?: string } = {},
  ) {
    const [row] = await tx
      .select({ taken: count() })
      .from(deliverySlotHolds)
      .where(
        and(
          eq(deliverySlotHolds.zone, zone),
          eq(deliverySlotHolds.date, date),
          takes(now),
          exclude.id ? ne(deliverySlotHolds.id, exclude.id) : undefined,
          exclude.reference ? ne(deliverySlotHolds.reference, exclude.reference) : undefined,
        ),
      );
    return row?.taken ?? 0;
  }
}
