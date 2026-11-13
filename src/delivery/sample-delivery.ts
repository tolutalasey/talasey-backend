import { sql } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { deliveryRates, deliverySlotSettings, deliveryZones } from '../database/schema/index.js';

// SAMPLE DATA. Zones, rates and slot capacity are placeholders until the carrier's zone and rate
// tables arrive. Every row is stored with sample = true and the API reports it.

const zones: Record<string, string[]> = {
  'north-west': ['BB', 'BL', 'CA', 'CH', 'CW', 'FY', 'L', 'LA', 'M', 'OL', 'PR', 'SK', 'WA', 'WN'],
  yorkshire: ['BD', 'DN', 'HD', 'HG', 'HU', 'HX', 'LS', 'S', 'WF', 'YO'],
  midlands: ['B', 'CV', 'DE', 'DY', 'LE', 'NG', 'ST', 'WS', 'WV'],
  london: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
};

const zoneSurchargePence: Record<string, number> = {
  'north-west': 0,
  yorkshire: 500,
  midlands: 1000,
  london: 2500,
};

const palletBands = [
  { maxWeightKg: 250, pricePence: 4500 },
  { maxWeightKg: 500, pricePence: 5500 },
  { maxWeightKg: 1000, pricePence: 6500 },
  { maxWeightKg: 1200, pricePence: 7500 },
];

const parcelBands = [{ maxWeightKg: 30, pricePence: 995 }];

const slotSettings: Record<string, { palletsPerDay: number; leadTimeDays: number }> = {
  'north-west': { palletsPerDay: 8, leadTimeDays: 2 },
  yorkshire: { palletsPerDay: 6, leadTimeDays: 3 },
  midlands: { palletsPerDay: 6, leadTimeDays: 3 },
  london: { palletsPerDay: 4, leadTimeDays: 4 },
};

export const seedRows = Object.entries(zones).flatMap(([zone, areas]) =>
  areas.map((postcodeArea) => ({ postcodeArea, zone, sample: true })),
);

export const rateRows = Object.entries(zoneSurchargePence).flatMap(([zone, surcharge]) => [
  ...parcelBands.map((band) => ({
    zone,
    shipment: 'parcel' as const,
    maxWeightKg: band.maxWeightKg,
    pricePence: band.pricePence + Math.round(surcharge / 5),
    sample: true,
  })),
  ...palletBands.map((band) => ({
    zone,
    shipment: 'pallet' as const,
    maxWeightKg: band.maxWeightKg,
    pricePence: band.pricePence + surcharge,
    sample: true,
  })),
]);

export const slotSettingRows = Object.entries(slotSettings).map(([zone, settings]) => ({
  zone,
  ...settings,
  sample: true,
}));

// Only fills empty tables, so zones and rates changed in the admin are never overwritten.
export async function seedSampleDelivery(db: Database) {
  const [existing] = await db.select({ zone: deliveryZones.zone }).from(deliveryZones).limit(1);
  if (existing) return;
  await db.transaction(async (tx) => {
    await tx
      .insert(deliveryZones)
      .values(seedRows)
      .onConflictDoUpdate({
        target: deliveryZones.postcodeArea,
        set: { zone: sql`excluded.zone`, sample: sql`excluded.sample`, updatedAt: sql`now()` },
      });
    await tx
      .insert(deliveryRates)
      .values(rateRows)
      .onConflictDoUpdate({
        target: [deliveryRates.zone, deliveryRates.shipment, deliveryRates.maxWeightKg],
        set: {
          pricePence: sql`excluded.price_pence`,
          sample: sql`excluded.sample`,
          updatedAt: sql`now()`,
        },
      });
    await tx
      .insert(deliverySlotSettings)
      .values(slotSettingRows)
      .onConflictDoUpdate({
        target: deliverySlotSettings.zone,
        set: {
          palletsPerDay: sql`excluded.pallets_per_day`,
          leadTimeDays: sql`excluded.lead_time_days`,
          sample: sql`excluded.sample`,
          updatedAt: sql`now()`,
        },
      });
  });
}
