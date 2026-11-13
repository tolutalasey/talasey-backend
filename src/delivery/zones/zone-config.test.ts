import { describe, expect, it } from 'vitest';
import { zoneConfigInputSchema, zoneConfigProblems, type ZoneConfig } from './zone-config.js';

const london: ZoneConfig = {
  zone: 'london',
  areas: ['E', 'SE'],
  rates: [],
  palletsPerDay: 4,
  leadTimeDays: 4,
  sample: false,
};

const input = (overrides = {}) =>
  zoneConfigInputSchema.parse({
    areas: ['m', 'SK'],
    rates: [{ shipment: 'pallet', maxWeightKg: 1000, pricePence: 6500 }],
    palletsPerDay: 8,
    leadTimeDays: 2,
    ...overrides,
  });

describe('zone settings', () => {
  it('upper-cases postcode areas', () => {
    expect(input().areas).toEqual(['M', 'SK']);
  });

  it('needs both pallet settings or neither', () => {
    expect(() => input({ palletsPerDay: null })).toThrow(/both pallets per day and lead time/);
  });

  it('finds areas taken by another zone and doubled rate bands', () => {
    const problems = zoneConfigProblems(
      'north-west',
      input({
        areas: ['M', 'SE', 'M'],
        rates: [
          { shipment: 'pallet', maxWeightKg: 1000, pricePence: 6500 },
          { shipment: 'pallet', maxWeightKg: 1000, pricePence: 7000 },
        ],
      }),
      [london],
    );
    expect(problems).toEqual([
      'SE is already in london',
      'M is listed twice',
      'There are two pallet rates up to 1000 kg',
    ]);
  });

  it('asks for pallet settings when there are pallet rates', () => {
    const problems = zoneConfigProblems(
      'parcels-only',
      input({ palletsPerDay: null, leadTimeDays: null }),
      [],
    );
    expect(problems).toEqual(['Pallet rates need pallets per day and a lead time']);
  });
});
