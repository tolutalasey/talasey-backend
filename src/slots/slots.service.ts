import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { DeliveryService } from '../delivery/delivery.service.js';
import type { Postcode } from '../delivery/postcode.js';
import {
  SLOT_REPOSITORY,
  type ConfirmOutcome,
  type SlotHold,
  type SlotRepository,
} from './slot.repository.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import { LockService } from '../store/lock.service.js';
import { slotTakenKey } from './slot-cache.js';
import { addWorkingDays, todayInLondon, workingDaysFrom } from './working-days.js';

const TAKEN_CACHE_SECONDS = 15;

export interface SlotAvailability {
  postcode: string;
  zone: string;
  sample: boolean;
  slots: { date: string; remaining: number }[];
}

export type AvailabilityResult =
  | { status: 'available'; availability: SlotAvailability }
  | { status: 'no-zone' }
  | { status: 'no-slots'; zone: string };

export type HoldResult =
  | { status: 'held'; hold: SlotHold }
  | { status: 'no-zone' }
  | { status: 'no-slots'; zone: string }
  | { status: 'date-not-offered' }
  | { status: 'full' };

@Injectable()
export class SlotsService {
  constructor(
    private readonly delivery: DeliveryService,
    @Inject(SLOT_REPOSITORY) private readonly slots: SlotRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    private readonly locks: LockService,
  ) {}

  async availability(postcode: Postcode): Promise<AvailabilityResult> {
    const zone = await this.delivery.findZone(postcode);
    if (!zone) return { status: 'no-zone' };
    const settings = await this.slots.findSettings(zone.zone);
    if (!settings) return { status: 'no-slots', zone: zone.zone };

    const now = this.clock();
    const dates = this.offeredDates(settings.leadTimeDays, now);
    const taken = await this.taken(zone.zone, dates, now);

    return {
      status: 'available',
      availability: {
        postcode: zone.postcode,
        zone: zone.zone,
        sample: zone.sample || settings.sample,
        slots: dates.map((date) => ({
          date,
          remaining: Math.max(settings.palletsPerDay - (taken.get(date) ?? 0), 0),
        })),
      },
    };
  }

  async hold(postcode: Postcode, date: string, reference: string): Promise<HoldResult> {
    const zone = await this.delivery.findZone(postcode);
    if (!zone) return { status: 'no-zone' };
    const settings = await this.slots.findSettings(zone.zone);
    if (!settings) return { status: 'no-slots', zone: zone.zone };

    const now = this.clock();
    if (!this.offeredDates(settings.leadTimeDays, now).includes(date)) {
      return { status: 'date-not-offered' };
    }

    // The Redis lock queues checkouts for the same day across API instances; the row lock in
    // Postgres still guarantees the day is never overbooked.
    const outcome = await this.locks.withLock(`slot:${zone.zone}:${date}`, () =>
      this.slots.hold({
        zone: zone.zone,
        date,
        reference,
        capacity: settings.palletsPerDay,
        expiresAt: new Date(now.getTime() + this.config.SLOT_HOLD_MINUTES * 60_000),
        now,
      }),
    );
    await this.store.delete(slotTakenKey(zone.zone));
    return outcome;
  }

  async confirm(id: string): Promise<ConfirmOutcome> {
    const outcome = await this.slots.confirm(id, this.clock());
    if (outcome.status === 'booked') await this.store.delete(slotTakenKey(outcome.hold.zone));
    return outcome;
  }

  async release(id: string): Promise<SlotHold | null> {
    const hold = await this.slots.release(id);
    if (hold) await this.store.delete(slotTakenKey(hold.zone));
    return hold;
  }

  findHold(id: string): Promise<SlotHold | null> {
    return this.slots.findHold(id);
  }

  isActive(hold: SlotHold): boolean {
    return hold.status === 'booked' || (hold.status === 'held' && hold.expiresAt > this.clock());
  }

  // Places taken per day, cached briefly so busy product and checkout pages don't count holds on
  // every request. Any hold, booking or release in the zone clears it.
  private async taken(zone: string, dates: string[], now: Date): Promise<Map<string, number>> {
    const cached = await this.store.get(slotTakenKey(zone));
    if (cached) {
      const parsed = JSON.parse(cached) as { dates: string[]; taken: [string, number][] };
      if (parsed.dates.join() === dates.join()) return new Map(parsed.taken);
    }
    const taken = await this.slots.countTaken(zone, dates, now);
    await this.store.set(
      slotTakenKey(zone),
      JSON.stringify({ dates, taken: [...taken] }),
      TAKEN_CACHE_SECONDS,
    );
    return taken;
  }

  private offeredDates(leadTimeDays: number, now: Date): string[] {
    const first = addWorkingDays(todayInLondon(now), leadTimeDays);
    return workingDaysFrom(first, this.config.SLOT_DAYS_AHEAD);
  }
}
