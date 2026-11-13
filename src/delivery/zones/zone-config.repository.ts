import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gt, gte, or, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../database/client.js';
import { DATABASE } from '../../database/database.module.js';
import {
  deliveryRates,
  deliverySlotHolds,
  deliverySlotSettings,
  deliveryZones,
} from '../../database/schema/index.js';
import type { ZoneConfig } from './zone-config.js';

export type ZoneState = Omit<ZoneConfig, 'zone'>;

// A zone's postcode areas, rates and pallet settings, read and written as one thing.
@Injectable()
export class ZoneConfigRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(executor: Executor = this.db): Promise<ZoneConfig[]> {
    const [zones, rates, settings] = await Promise.all([
      executor.select().from(deliveryZones).orderBy(asc(deliveryZones.postcodeArea)),
      executor
        .select()
        .from(deliveryRates)
        .orderBy(asc(deliveryRates.shipment), asc(deliveryRates.maxWeightKg)),
      executor.select().from(deliverySlotSettings),
    ]);
    const names = new Set([
      ...zones.map((row) => row.zone),
      ...rates.map((row) => row.zone),
      ...settings.map((row) => row.zone),
    ]);
    return [...names].sort().map((zone) => {
      const own = settings.find((row) => row.zone === zone);
      const areas = zones.filter((row) => row.zone === zone);
      const zoneRates = rates.filter((row) => row.zone === zone);
      return {
        zone,
        areas: areas.map((row) => row.postcodeArea),
        rates: zoneRates.map(({ shipment, maxWeightKg, pricePence }) => ({
          shipment,
          maxWeightKg,
          pricePence,
        })),
        palletsPerDay: own?.palletsPerDay ?? null,
        leadTimeDays: own?.leadTimeDays ?? null,
        sample: [...areas, ...zoneRates, ...(own ? [own] : [])].some((row) => row.sample),
      };
    });
  }

  async find(zone: string, executor: Executor = this.db): Promise<ZoneState | null> {
    const found = (await this.list(executor)).find((config) => config.zone === zone);
    if (!found) return null;
    return {
      areas: found.areas,
      rates: found.rates,
      palletsPerDay: found.palletsPerDay,
      leadTimeDays: found.leadTimeDays,
      sample: found.sample,
    };
  }

  async replace(executor: Executor, zone: string, state: ZoneState | null): Promise<void> {
    await executor.delete(deliveryZones).where(eq(deliveryZones.zone, zone));
    await executor.delete(deliveryRates).where(eq(deliveryRates.zone, zone));
    await executor.delete(deliverySlotSettings).where(eq(deliverySlotSettings.zone, zone));
    if (!state) return;

    const sample = state.sample;
    await executor
      .insert(deliveryZones)
      .values(state.areas.map((postcodeArea) => ({ postcodeArea, zone, sample })));
    await executor
      .insert(deliveryRates)
      .values(state.rates.map((rate) => ({ ...rate, zone, sample })));
    if (state.palletsPerDay !== null && state.leadTimeDays !== null) {
      await executor.insert(deliverySlotSettings).values({
        zone,
        palletsPerDay: state.palletsPerDay,
        leadTimeDays: state.leadTimeDays,
        sample,
        updatedAt: sql`now()`,
      });
    }
  }

  // Held and booked pallet deliveries per day from a date on, for the admin calendar.
  days(zone: string, from: string, now: Date) {
    return this.db
      .select({ date: deliverySlotHolds.date, status: deliverySlotHolds.status, taken: count() })
      .from(deliverySlotHolds)
      .where(
        and(
          eq(deliverySlotHolds.zone, zone),
          gte(deliverySlotHolds.date, from),
          or(
            eq(deliverySlotHolds.status, 'booked'),
            and(eq(deliverySlotHolds.status, 'held'), gt(deliverySlotHolds.expiresAt, now)),
          ),
        ),
      )
      .groupBy(deliverySlotHolds.date, deliverySlotHolds.status);
  }
}
