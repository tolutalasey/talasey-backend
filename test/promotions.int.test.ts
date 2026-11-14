import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseUrl, signIn, startApi } from './support/app.js';

const address = {
  firstName: 'Amy',
  lastName: 'Shopper',
  address1: '1 Piccadilly',
  city: 'Manchester',
  postcode: 'M1 1AE',
  phone: '0161 000 0000',
};

describe.skipIf(!databaseUrl)('promotions', () => {
  let app: NestExpressApplication;
  let staff: string;
  const http = () => request(app.getHttpServer());
  const code = `TEST${Date.now().toString(36).toUpperCase()}`;

  async function basketWithJointing(quantity = 2) {
    const { body: basket } = await http().post('/store/baskets').expect(201);
    const { body: product } = await http()
      .get('/store/products/pavetuf-jointing-compound')
      .expect(200);
    await http()
      .post(`/store/baskets/${basket.id}/lines`)
      .send({ variantId: product.variants[0].id, quantity })
      .expect(201);
    return basket.id as string;
  }

  beforeAll(async () => {
    app = await startApi();
    staff = await signIn(app, 'catalogue');
    await http()
      .post('/admin/promotions')
      .set('authorization', staff)
      .send({
        name: 'Test ten per cent',
        code: code.toLowerCase(),
        kind: 'percent',
        value: 10,
        minSpendPence: 0,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: null,
        maxUses: 1,
      })
      .expect(201);
  });

  afterAll(() => app?.close());

  it('takes 10% off the products with a code, and says why another code does not apply', async () => {
    const basketId = await basketWithJointing();
    await http()
      .put(`/store/baskets/${basketId}/promotion`)
      .send({ code: 'NOT-A-CODE' })
      .expect(422)
      .expect(({ body }) => expect(body.message).toMatch(/recognise/));

    const { body } = await http()
      .put(`/store/baskets/${basketId}/promotion`)
      .send({ code: code.toLowerCase() })
      .expect(200);
    expect(body.discountPence).toBe(Math.floor(body.itemTotalPence / 10));
    expect(body.promotions).toEqual([{ name: 'Test ten per cent', code }]);
    expect(body.totalPence).toBe(body.itemTotalPence - body.discountPence);
  });

  it('records the discount on the order and stops a one-use code after it is used', async () => {
    const basketId = await basketWithJointing();
    await http().put(`/store/baskets/${basketId}/promotion`).send({ code }).expect(200);
    await http()
      .put(`/store/baskets/${basketId}/contact`)
      .send({ email: 'a@example.com', address });
    await http()
      .put(`/store/baskets/${basketId}/delivery`)
      .send({ shipment: 'parcel' })
      .expect(200);
    const { body: view } = await http().get(`/store/baskets/${basketId}`).expect(200);
    await http().post(`/store/baskets/${basketId}/payment`).expect(200);
    const { body: placed } = await http()
      .post(`/store/baskets/${basketId}/complete`)
      .send({})
      .expect(200);
    const { body: order } = await http().get(`/store/orders/${placed.orderId}`).expect(200);
    expect(order).toMatchObject({
      discountPence: view.discountPence,
      promotions: [code],
      totalPence: view.totalPence,
    });

    const next = await basketWithJointing();
    await http()
      .put(`/store/baskets/${next}/promotion`)
      .send({ code })
      .expect(422)
      .expect(({ body }) => expect(body.message).toBe('That code has been used up.'));
  });

  it('checks what staff enter', async () => {
    await http()
      .post('/admin/promotions')
      .set('authorization', staff)
      .send({
        name: 'Too generous',
        code: 'HALF-AND-MORE',
        kind: 'percent',
        value: 95,
        startsAt: new Date().toISOString(),
        endsAt: null,
        maxUses: null,
      })
      .expect(422)
      .expect(({ body }) => expect(body.message).toBe('A percentage off is between 1 and 90'));
  });
});
