import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { CLOCK, ClockModule } from '../src/common/clock.js';
import { APP_CONFIG, ConfigModule } from '../src/config/config.module.js';
import { parseConfig } from '../src/config/config.schema.js';
import { DELIVERY_RATE_REPOSITORY } from '../src/delivery/delivery-rate.repository.js';
import { DELIVERY_ZONE_REPOSITORY } from '../src/delivery/delivery-zone.repository.js';
import type { ConfirmOutcome, SlotHold, SlotRepository } from '../src/slots/slot.repository.js';
import { SLOT_REPOSITORY } from '../src/slots/slot.repository.js';
import { SlotsModule } from '../src/slots/slots.module.js';
import { StoreModule } from '../src/store/store.module.js';

const HOLD_ID = '6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f';
const now = new Date('2026-11-12T09:00:00Z');

const heldSlot: SlotHold = {
  id: HOLD_ID,
  zone: 'north-west',
  date: '2026-11-16',
  reference: 'cart_1',
  status: 'held',
  expiresAt: new Date('2026-11-12T09:15:00Z'),
};

let confirmOutcome: ConfirmOutcome;
let full: boolean;

const slots: SlotRepository = {
  findSettings: async (zone) =>
    zone === 'north-west' ? { zone, palletsPerDay: 3, leadTimeDays: 2, sample: true } : null,
  countTaken: async () => new Map([['2026-11-16', 1]]),
  hold: async (input) =>
    full ? { status: 'full' } : { status: 'held', hold: { ...heldSlot, date: input.date } },
  confirm: async () => confirmOutcome,
  release: async (id) => (id === HOLD_ID ? { ...heldSlot, status: 'released' } : null),
  findHold: async (id) => (id === HOLD_ID ? heldSlot : null),
};

describe('delivery slots HTTP API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ClockModule, StoreModule, SlotsModule],
    })
      .overrideProvider(DELIVERY_ZONE_REPOSITORY)
      .useValue({
        findByPostcodeArea: async (area: string) =>
          area === 'M' ? { postcodeArea: 'M', zone: 'north-west', sample: true } : null,
      })
      .overrideProvider(DELIVERY_RATE_REPOSITORY)
      .useValue({ findRate: async () => null })
      .overrideProvider(SLOT_REPOSITORY)
      .useValue(slots)
      .overrideProvider(CLOCK)
      .useValue(() => now)
      .overrideProvider(APP_CONFIG)
      .useValue(parseConfig({ DATABASE_URL: 'postgres://localhost/db', SLOT_DAYS_AHEAD: '2' }))
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    full = false;
    confirmOutcome = { status: 'booked', hold: { ...heldSlot, status: 'booked' } };
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('lists the offered days with what is left', () =>
    http()
      .get('/delivery/slots')
      .query({ postcode: 'M1 1AE' })
      .expect(200)
      .expect({
        postcode: 'M1 1AE',
        zone: 'north-west',
        sample: true,
        slots: [
          { date: '2026-11-16', remaining: 2 },
          { date: '2026-11-17', remaining: 3 },
        ],
      }));

  it('returns 404 for slots outside our zones', () =>
    http().get('/delivery/slots').query({ postcode: 'KW1 4YT' }).expect(404));

  it('holds a slot', () =>
    http()
      .post('/delivery/slot-holds')
      .send({ postcode: 'M1 1AE', date: '2026-11-17', reference: 'cart_1' })
      .expect(201)
      .expect({
        id: HOLD_ID,
        zone: 'north-west',
        date: '2026-11-17',
        reference: 'cart_1',
        status: 'held',
        expiresAt: '2026-11-12T09:15:00.000Z',
        active: true,
      }));

  it('returns 409 when the day is full', () => {
    full = true;
    return http()
      .post('/delivery/slot-holds')
      .send({ postcode: 'M1 1AE', date: '2026-11-17', reference: 'cart_1' })
      .expect(409);
  });

  it('returns 422 for a date we do not offer', () =>
    http()
      .post('/delivery/slot-holds')
      .send({ postcode: 'M1 1AE', date: '2026-11-13', reference: 'cart_1' })
      .expect(422));

  it('returns 400 for a malformed date', () =>
    http()
      .post('/delivery/slot-holds')
      .send({ postcode: 'M1 1AE', date: '17/11/2026', reference: 'cart_1' })
      .expect(400));

  it('reads a hold', () =>
    http()
      .get(`/delivery/slot-holds/${HOLD_ID}`)
      .expect(200)
      .expect((response) => {
        if (response.body.active !== true) throw new Error('expected an active hold');
      }));

  it('returns 400 for a hold id that is not a UUID', () =>
    http().get('/delivery/slot-holds/not-a-uuid').expect(400));

  it('confirms a hold', () =>
    http()
      .post(`/delivery/slot-holds/${HOLD_ID}/confirm`)
      .expect(200)
      .expect((response) => {
        if (response.body.status !== 'booked') throw new Error('expected booked');
      }));

  it('returns 409 when confirming a hold that expired into a full day', () => {
    confirmOutcome = { status: 'full' };
    return http().post(`/delivery/slot-holds/${HOLD_ID}/confirm`).expect(409);
  });

  it('releases a hold', () => http().delete(`/delivery/slot-holds/${HOLD_ID}`).expect(204));

  it('returns 404 when releasing an unknown hold', () =>
    http().delete('/delivery/slot-holds/00000000-0000-4000-8000-000000000000').expect(404));
});
