import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseUrl, signIn, startApi } from './support/app.js';

const zone = `race-${Date.now()}`;
const settings = {
  areas: ['ZE'],
  rates: [
    { shipment: 'pallet', maxWeightKg: 1000, pricePence: 9900 },
    { shipment: 'parcel', maxWeightKg: 30, pricePence: 1500 },
  ],
  palletsPerDay: 3,
  leadTimeDays: 1,
};

describe.skipIf(!databaseUrl)('delivery zones in the admin, and holding days', () => {
  let app: NestExpressApplication;
  let staff: string;

  beforeAll(async () => {
    app = await startApi();
    staff = await signIn(app, 'catalogue');
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .delete(`/admin/delivery/zones/${zone}`)
      .set('authorization', staff);
    await app?.close();
  });

  const http = () => request(app.getHttpServer());

  it('keeps zones to staff with the delivery permission', async () => {
    await http().get('/admin/delivery/zones').expect(401);
    const editor = await signIn(app, 'editor');
    await http().get('/admin/delivery/zones').set('authorization', editor).expect(403);
  });

  it('saves a zone and quotes from it straight away', async () => {
    await http()
      .put(`/admin/delivery/zones/${zone}`)
      .set('authorization', staff)
      .send(settings)
      .expect(200);

    const { body } = await http()
      .get('/delivery/quotes')
      .query({ postcode: 'ZE1 0AA', shipment: 'pallet', weightKg: 600 })
      .expect(200);
    expect(body).toMatchObject({ zone, pricePence: 9900, sample: false });
  });

  it('refuses an area that belongs to another zone', async () => {
    const { body } = await http()
      .put(`/admin/delivery/zones/${zone}`)
      .set('authorization', staff)
      .send({ ...settings, areas: ['ZE', 'M'] })
      .expect(422);
    expect(body.message).toContain('M is already in north-west');
  });

  it('never gives away more places than the day has when many checkouts hold at once', async () => {
    const { body: availability } = await http()
      .get('/delivery/slots')
      .query({ postcode: 'ZE1 0AA' })
      .expect(200);
    const date = availability.slots[0].date as string;

    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        http()
          .post('/delivery/slot-holds')
          .send({ postcode: 'ZE1 0AA', date, reference: `${zone}-basket-${index}` }),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(3);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(9);

    const { body: after } = await http().get('/delivery/slots').query({ postcode: 'ZE1 0AA' });
    expect(after.slots[0]).toEqual({ date, remaining: 0 });

    const { body: days } = await http()
      .get(`/admin/delivery/zones/${zone}/days`)
      .set('authorization', staff)
      .expect(200);
    expect(days.find((day: { date: string }) => day.date === date)).toMatchObject({
      capacity: 3,
      held: 3,
      booked: 0,
    });
  });

  it('puts the old rates back from the audit log', async () => {
    await http()
      .put(`/admin/delivery/zones/${zone}`)
      .set('authorization', staff)
      .send({ ...settings, rates: [{ shipment: 'pallet', maxWeightKg: 1000, pricePence: 1 }] })
      .expect(200);
    const { body: log } = await http()
      .get('/admin/audit')
      .query({ subject: 'delivery_zone', subjectId: zone })
      .set('authorization', staff);
    await http().post(`/admin/audit/${log[0].id}/restore`).set('authorization', staff).expect(200);

    const { body } = await http()
      .get('/delivery/quotes')
      .query({ postcode: 'ZE1 0AA', shipment: 'parcel', weightKg: 10 })
      .expect(200);
    expect(body.pricePence).toBe(1500);
  });
});
