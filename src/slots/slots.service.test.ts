import { describe, expect, it, vi } from 'vitest';
import { parseConfig } from '../config/config.schema.js';
import type { DeliveryService } from '../delivery/delivery.service.js';
import { parsePostcode, type Postcode } from '../delivery/postcode.js';
import type { SlotHold, SlotRepository } from './slot.repository.js';
import { MemoryKeyValueStore } from '../store/memory-key-value-store.js';
import { LockService } from '../store/lock.service.js';
import { SlotsService } from './slots.service.js';

const postcode = (value: string) => parsePostcode(value) as Postcode;
const thursdayMorning = new Date('2026-11-12T09:00:00Z');

function setup(overrides: Partial<SlotRepository> = {}) {
  const delivery = {
    findZone: async (code: Postcode) =>
      code.area === 'M'
        ? { postcode: code.formatted, area: 'M', zone: 'north-west', sample: true }
        : code.area === 'SE'
          ? { postcode: code.formatted, area: 'SE', zone: 'london', sample: false }
          : null,
  } as unknown as DeliveryService;

  const repository: SlotRepository = {
    findSettings: async (zone) =>
      zone === 'north-west' ? { zone, palletsPerDay: 2, leadTimeDays: 2, sample: false } : null,
    countTaken: async () => new Map([['2026-11-16', 2]]),
    hold: vi.fn(async (input) => ({
      status: 'held' as const,
      hold: { id: 'h1', status: 'held' as const, ...input },
    })),
    confirm: async () => ({ status: 'not-found' }),
    release: async () => null,
    findHold: async () => null,
    ...overrides,
  };

  const config = parseConfig({
    DATABASE_URL: 'postgres://localhost/db',
    SLOT_HOLD_MINUTES: '15',
    SLOT_DAYS_AHEAD: '3',
  });
  const store = new MemoryKeyValueStore();
  return {
    repository,
    store,
    service: new SlotsService(
      delivery,
      repository,
      config,
      () => thursdayMorning,
      store,
      new LockService(store),
    ),
  };
}

describe('SlotsService', () => {
  it('offers working days after the lead time, with what is left', async () => {
    const { service } = setup();
    await expect(service.availability(postcode('M1 1AE'))).resolves.toEqual({
      status: 'available',
      availability: {
        postcode: 'M1 1AE',
        zone: 'north-west',
        sample: true,
        slots: [
          { date: '2026-11-16', remaining: 0 },
          { date: '2026-11-17', remaining: 2 },
          { date: '2026-11-18', remaining: 2 },
        ],
      },
    });
  });

  it('says when we do not cover the postcode or the zone has no slots', async () => {
    const { service } = setup();
    await expect(service.availability(postcode('KW1 4YT'))).resolves.toEqual({ status: 'no-zone' });
    await expect(service.availability(postcode('SE2 0NX'))).resolves.toEqual({
      status: 'no-slots',
      zone: 'london',
    });
  });

  it('holds an offered date until the hold time runs out', async () => {
    const { service, repository } = setup();
    await service.hold(postcode('M1 1AE'), '2026-11-17', 'cart_1');
    expect(repository.hold).toHaveBeenCalledWith({
      zone: 'north-west',
      date: '2026-11-17',
      reference: 'cart_1',
      capacity: 2,
      expiresAt: new Date('2026-11-12T09:15:00Z'),
      now: thursdayMorning,
    });
  });

  it.each(['2026-11-13', '2026-11-14', '2026-11-19'])(
    'refuses %s, which is not offered',
    async (date) => {
      const { service, repository } = setup();
      await expect(service.hold(postcode('M1 1AE'), date, 'cart_1')).resolves.toEqual({
        status: 'date-not-offered',
      });
      expect(repository.hold).not.toHaveBeenCalled();
    },
  );

  it('treats a held slot as active only until it expires', () => {
    const { service } = setup();
    const hold = (status: SlotHold['status'], expiresAt: string): SlotHold => ({
      id: 'h1',
      zone: 'north-west',
      date: '2026-11-17',
      reference: 'cart_1',
      status,
      expiresAt: new Date(expiresAt),
    });
    expect(service.isActive(hold('held', '2026-11-12T09:01:00Z'))).toBe(true);
    expect(service.isActive(hold('held', '2026-11-12T08:59:00Z'))).toBe(false);
    expect(service.isActive(hold('booked', '2026-11-12T08:59:00Z'))).toBe(true);
    expect(service.isActive(hold('released', '2026-11-12T09:30:00Z'))).toBe(false);
  });

  it('counts places from the cache until a hold in the zone clears it', async () => {
    const countTaken = vi.fn(async () => new Map<string, number>());
    const { service } = setup({ countTaken });

    await service.availability(postcode('M1 1AE'));
    await service.availability(postcode('M1 1AE'));
    expect(countTaken).toHaveBeenCalledTimes(1);

    await service.hold(postcode('M1 1AE'), '2026-11-17', 'cart_1');
    await service.availability(postcode('M1 1AE'));
    expect(countTaken).toHaveBeenCalledTimes(2);
  });

  it('holds the same day one checkout at a time', async () => {
    let running = 0;
    let most = 0;
    const { service } = setup({
      hold: async (input) => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        running -= 1;
        return { status: 'held', hold: { id: input.reference, status: 'held', ...input } };
      },
    });

    await Promise.all(
      ['a', 'b', 'c'].map((cart) => service.hold(postcode('M1 1AE'), '2026-11-17', cart)),
    );
    expect(most).toBe(1);
  });
});
