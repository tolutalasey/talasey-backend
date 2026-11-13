import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/database/client.js';
import { runMigrations } from '../src/database/migrate.js';
import { deliverySlotHolds, deliverySlots } from '../src/database/schema/index.js';
import { DrizzleSlotRepository } from '../src/slots/drizzle-slot.repository.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const ZONE = 'integration-test';
const DATE = '2030-01-07';
const now = new Date('2030-01-01T09:00:00Z');
const inFifteenMinutes = new Date('2030-01-01T09:15:00Z');
const aMinuteAgo = new Date('2030-01-01T08:59:00Z');

describe.skipIf(!databaseUrl)('DrizzleSlotRepository against Postgres', () => {
  let primary: ReturnType<typeof createDatabase>;
  let others: ReturnType<typeof createDatabase>[];
  let repository: DrizzleSlotRepository;

  const hold = (reference: string, capacity = 2, expiresAt = inFifteenMinutes) =>
    repository.hold({ zone: ZONE, date: DATE, reference, capacity, expiresAt, now });

  beforeAll(async () => {
    await runMigrations(databaseUrl);
    primary = createDatabase(databaseUrl);
    others = Array.from({ length: 3 }, () => createDatabase(databaseUrl));
    repository = new DrizzleSlotRepository(primary.db);
  });

  beforeEach(async () => {
    const { db } = primary;
    await db.delete(deliverySlotHolds).where(eq(deliverySlotHolds.zone, ZONE));
    await db.delete(deliverySlots).where(eq(deliverySlots.zone, ZONE));
  });

  afterAll(async () => {
    await Promise.all([primary, ...others].map((connection) => connection.close()));
  });

  it('never overbooks a day when many carts hold at once', async () => {
    const repositories = [primary, ...others].map(({ db }) => new DrizzleSlotRepository(db));
    const outcomes = await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        (repositories[index % repositories.length] ?? repository).hold({
          zone: ZONE,
          date: DATE,
          reference: `cart_${index}`,
          capacity: 5,
          expiresAt: inFifteenMinutes,
          now,
        }),
      ),
    );

    expect(outcomes.filter((outcome) => outcome.status === 'held')).toHaveLength(5);
    expect(outcomes.filter((outcome) => outcome.status === 'full')).toHaveLength(19);
    expect((await repository.countTaken(ZONE, [DATE], now)).get(DATE)).toBe(5);
  });

  it('frees the place when a hold expires', async () => {
    await hold('cart_a', 1, aMinuteAgo);
    await expect(hold('cart_b', 1)).resolves.toMatchObject({ status: 'held' });
  });

  it('keeps one hold per reference and moves it when the cart picks again', async () => {
    const first = await hold('cart_a');
    const second = await hold('cart_a');
    if (first.status !== 'held' || second.status !== 'held') throw new Error('expected holds');

    await expect(repository.findHold(first.hold.id)).resolves.toMatchObject({ status: 'released' });
    expect((await repository.countTaken(ZONE, [DATE], now)).get(DATE)).toBe(1);
  });

  it('keeps the old hold when the new pick is full', async () => {
    const mine = await hold('cart_a', 2);
    await hold('cart_b', 2);
    if (mine.status !== 'held') throw new Error('expected a hold');

    await expect(
      repository.hold({
        zone: ZONE,
        date: '2030-01-08',
        reference: 'cart_a',
        capacity: 0,
        expiresAt: inFifteenMinutes,
        now,
      }),
    ).resolves.toEqual({ status: 'full' });
    await expect(repository.findHold(mine.hold.id)).resolves.toMatchObject({ status: 'held' });
  });

  it('books a hold, and booking again is harmless', async () => {
    const held = await hold('cart_a');
    if (held.status !== 'held') throw new Error('expected a hold');

    await expect(repository.confirm(held.hold.id, now)).resolves.toMatchObject({
      status: 'booked',
    });
    await expect(repository.confirm(held.hold.id, now)).resolves.toMatchObject({
      status: 'booked',
    });
  });

  it('books an expired hold while the day still has room', async () => {
    const held = await hold('cart_a', 2, aMinuteAgo);
    if (held.status !== 'held') throw new Error('expected a hold');
    await expect(repository.confirm(held.hold.id, now)).resolves.toMatchObject({
      status: 'booked',
    });
  });

  it('refuses an expired hold once someone else took the place', async () => {
    const late = await hold('cart_a', 1, aMinuteAgo);
    await hold('cart_b', 1);
    if (late.status !== 'held') throw new Error('expected a hold');

    await expect(repository.confirm(late.hold.id, now)).resolves.toEqual({ status: 'full' });
  });

  it('cannot book a released hold', async () => {
    const held = await hold('cart_a');
    if (held.status !== 'held') throw new Error('expected a hold');
    await repository.release(held.hold.id);

    await expect(repository.confirm(held.hold.id, now)).resolves.toEqual({ status: 'released' });
  });

  it('does not release a booked hold', async () => {
    const held = await hold('cart_a');
    if (held.status !== 'held') throw new Error('expected a hold');
    await repository.confirm(held.hold.id, now);

    await expect(repository.release(held.hold.id)).resolves.toMatchObject({ status: 'booked' });
  });

  it('reports an unknown hold', async () => {
    await expect(repository.confirm('00000000-0000-4000-8000-000000000000', now)).resolves.toEqual({
      status: 'not-found',
    });
  });
});
