import { describe, expect, it } from 'vitest';
import type { DeliveryRate, DeliveryRateRepository, Shipment } from './delivery-rate.repository.js';
import type { DeliveryZone, DeliveryZoneRepository } from './delivery-zone.repository.js';
import { DeliveryService } from './delivery.service.js';
import { parsePostcode, type Postcode } from './postcode.js';

class InMemoryZones implements DeliveryZoneRepository {
  constructor(private readonly rows: DeliveryZone[]) {}

  async findByPostcodeArea(area: string) {
    return this.rows.find((row) => row.postcodeArea === area) ?? null;
  }
}

class InMemoryRates implements DeliveryRateRepository {
  constructor(private readonly rows: DeliveryRate[]) {}

  async findRate(zone: string, shipment: Shipment, weightKg: number) {
    return (
      this.rows
        .filter((row) => row.zone === zone && row.shipment === shipment)
        .filter((row) => row.maxWeightKg >= weightKg)
        .sort((a, b) => a.maxWeightKg - b.maxWeightKg)[0] ?? null
    );
  }
}

const postcode = (value: string) => parsePostcode(value) as Postcode;

const rate = (shipment: Shipment, maxWeightKg: number, pricePence: number): DeliveryRate => ({
  zone: 'north-west',
  shipment,
  maxWeightKg,
  pricePence,
  sample: false,
});

describe('DeliveryService', () => {
  const service = new DeliveryService(
    new InMemoryZones([{ postcodeArea: 'M', zone: 'north-west', sample: true }]),
    new InMemoryRates([
      rate('parcel', 30, 995),
      rate('pallet', 250, 4500),
      rate('pallet', 1000, 6500),
    ]),
  );

  it('returns the zone for a known postcode area', async () => {
    await expect(service.findZone(postcode('m1 1ae'))).resolves.toEqual({
      postcode: 'M1 1AE',
      area: 'M',
      zone: 'north-west',
      sample: true,
    });
  });

  it('returns null for an area we do not cover', async () => {
    await expect(service.findZone(postcode('KW1 4YT'))).resolves.toBeNull();
  });

  it('quotes the smallest weight band that fits', async () => {
    const result = await service.quote(postcode('M1 1AE'), 'pallet', 251);
    expect(result).toEqual({
      status: 'quoted',
      quote: {
        postcode: 'M1 1AE',
        zone: 'north-west',
        shipment: 'pallet',
        weightKg: 251,
        pricePence: 6500,
        requiresSlot: true,
        sample: true,
      },
    });
  });

  it('includes the band edge', async () => {
    const result = await service.quote(postcode('M1 1AE'), 'pallet', 250);
    expect(result.status === 'quoted' && result.quote.pricePence).toBe(4500);
  });

  it('parcels need no slot', async () => {
    const result = await service.quote(postcode('M1 1AE'), 'parcel', 12);
    expect(result.status === 'quoted' && result.quote.requiresSlot).toBe(false);
  });

  it('has no rate when the weight is over every band', async () => {
    await expect(service.quote(postcode('M1 1AE'), 'parcel', 31)).resolves.toEqual({
      status: 'no-rate',
      zone: 'north-west',
    });
  });

  it('has no quote outside our zones', async () => {
    await expect(service.quote(postcode('KW1 4YT'), 'pallet', 100)).resolves.toEqual({
      status: 'no-zone',
      area: 'KW',
    });
  });
});
