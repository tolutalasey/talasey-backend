import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  DELIVERY_RATE_REPOSITORY,
  type DeliveryRateRepository,
} from '../src/delivery/delivery-rate.repository.js';
import {
  DELIVERY_ZONE_REPOSITORY,
  type DeliveryZoneRepository,
} from '../src/delivery/delivery-zone.repository.js';
import { DeliveryModule } from '../src/delivery/delivery.module.js';

const zones: DeliveryZoneRepository = {
  findByPostcodeArea: async (area) =>
    area === 'SK' ? { postcodeArea: 'SK', zone: 'north-west', sample: true } : null,
};

const rates: DeliveryRateRepository = {
  findRate: async (zone, shipment, weightKg) =>
    shipment === 'pallet' && weightKg <= 1000
      ? { zone, shipment, maxWeightKg: 1000, pricePence: 6500, sample: true }
      : null,
};

describe('delivery HTTP API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DeliveryModule] })
      .overrideProvider(DELIVERY_ZONE_REPOSITORY)
      .useValue(zones)
      .overrideProvider(DELIVERY_RATE_REPOSITORY)
      .useValue(rates)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  describe('GET /delivery/zones/:postcode', () => {
    it('returns the zone for a covered postcode', () =>
      request(app.getHttpServer())
        .get('/delivery/zones/sk4%201aa')
        .expect(200)
        .expect({ postcode: 'SK4 1AA', area: 'SK', zone: 'north-west', sample: true }));

    it('returns 400 for an invalid postcode', () =>
      request(app.getHttpServer()).get('/delivery/zones/not-a-postcode').expect(400));

    it('returns 404 for an area we do not cover', () =>
      request(app.getHttpServer()).get('/delivery/zones/KW1%204YT').expect(404));
  });

  describe('GET /delivery/quotes', () => {
    const quote = (query: Record<string, string>) =>
      request(app.getHttpServer()).get('/delivery/quotes').query(query);

    it('quotes a pallet', () =>
      quote({ postcode: 'SK4 1AA', shipment: 'pallet', weightKg: '850' }).expect(200).expect({
        postcode: 'SK4 1AA',
        zone: 'north-west',
        shipment: 'pallet',
        weightKg: 850,
        pricePence: 6500,
        requiresSlot: true,
        sample: true,
      }));

    it('returns 400 for an unknown shipment type', () =>
      quote({ postcode: 'SK4 1AA', shipment: 'van', weightKg: '10' }).expect(400));

    it('returns 400 for a weight that is not a positive number', () =>
      quote({ postcode: 'SK4 1AA', shipment: 'pallet', weightKg: '-1' }).expect(400));

    it('returns 400 for an invalid postcode', () =>
      quote({ postcode: 'nope', shipment: 'pallet', weightKg: '10' }).expect(400));

    it('returns 404 outside our zones', () =>
      quote({ postcode: 'KW1 4YT', shipment: 'pallet', weightKg: '10' }).expect(404));

    it('returns 422 when no rate fits', () =>
      quote({ postcode: 'SK4 1AA', shipment: 'parcel', weightKg: '40' }).expect(422));
  });
});
