import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/database/client.js';
import { runMigrations } from '../src/database/migrate.js';
import { seed } from '../src/database/seed.js';
import { DrizzleDeliveryRateRepository } from '../src/delivery/drizzle-delivery-rate.repository.js';
import { DrizzleDeliveryZoneRepository } from '../src/delivery/drizzle-delivery-zone.repository.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl) {
  console.warn('Skipping Postgres integration tests: DATABASE_URL is not set. CI runs them.');
}

describe.skipIf(!databaseUrl)('delivery zones and rates against Postgres', () => {
  let connection: ReturnType<typeof createDatabase>;
  let zones: DrizzleDeliveryZoneRepository;
  let rates: DrizzleDeliveryRateRepository;

  beforeAll(async () => {
    await runMigrations(databaseUrl);
    await seed(databaseUrl);
    connection = createDatabase(databaseUrl);
    zones = new DrizzleDeliveryZoneRepository(connection.db);
    rates = new DrizzleDeliveryRateRepository(connection.db);
  });

  afterAll(() => connection.close());

  it('finds a seeded area, marked as sample data', async () => {
    await expect(zones.findByPostcodeArea('OL')).resolves.toEqual({
      postcodeArea: 'OL',
      zone: 'north-west',
      sample: true,
    });
  });

  it('returns null for an unknown area', async () => {
    await expect(zones.findByPostcodeArea('ZZ')).resolves.toBeNull();
  });

  it('picks the smallest pallet band that fits the weight', async () => {
    await expect(rates.findRate('north-west', 'pallet', 600)).resolves.toMatchObject({
      maxWeightKg: 1000,
      pricePence: 6500,
      sample: true,
    });
  });

  it('has no parcel rate over 30 kg', async () => {
    await expect(rates.findRate('north-west', 'parcel', 31)).resolves.toBeNull();
  });

  it('can be seeded again without errors', async () => {
    await expect(seed(databaseUrl)).resolves.toBeUndefined();
  });
});
