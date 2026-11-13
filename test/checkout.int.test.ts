import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobQueue } from '../src/jobs/job-queue.js';
import { databaseUrl, signIn, startApi } from './support/app.js';
import { resetCatalogue } from './support/reset.js';

const address = {
  firstName: 'Amy',
  lastName: 'Shaw',
  address1: '1 High Street',
  city: 'Manchester',
  postcode: 'M1 1AE',
  phone: '07700 900123',
};
const access = { vehicleAccess: 'rigid', hardStanding: true, kerbsideOk: false };
const smallest = { FIN: 'Mild steel', FEET: 'No', CASTORS: 'No', DRAIN: 'No' };

describe.skipIf(!databaseUrl)('basket, checkout and orders', () => {
  let app: NestExpressApplication;
  let basketId: string;
  const http = () => request(app.getHttpServer());
  const basket = (path = '') => `/store/baskets/${basketId}${path}`;

  const variantOf = async (handle: string, index = 0) => {
    const { body } = await http().get(`/store/products/${handle}`).expect(200);
    return body.variants[index].id as string;
  };

  async function palletBasket() {
    await http()
      .post(basket('/lines'))
      .send({ variantId: await variantOf('pavetuf-jointing-compound'), quantity: 40 })
      .expect(201);
    await http().put(basket('/contact')).send({ email: 'amy@example.com', address }).expect(200);
    await http().put(basket('/delivery')).send({ shipment: 'pallet' }).expect(200);
    const { body: days } = await http().get(basket('/delivery-days')).expect(200);
    return days as { date: string; remaining: number }[];
  }

  beforeAll(async () => {
    await resetCatalogue(databaseUrl);
    app = await startApi();
  });

  beforeEach(async () => {
    const { body } = await http().post('/store/baskets').expect(201);
    basketId = body.id;
  });

  afterAll(() => app?.close());

  describe('the four checks that guard every order', () => {
    it('1. prices made-to-measure sizes on the server and ignores a price from the browser', async () => {
      const sienna = await variantOf('sienna-planter');
      const linea = await variantOf('linea-planter');
      await http()
        .post(basket('/lines'))
        .send({ variantId: sienna, quantity: 1 })
        .expect(422)
        .expect(({ body }) =>
          expect(body.message).toBe(
            'Enter your measurements to add Sienna planter to your basket.',
          ),
        );

      const dimensions = { W: 1600, D: 1600, H: 900 };
      await http()
        .post(basket('/bespoke-items'))
        .send({ variantId: sienna, dimensions, choices: smallest, unitPricePence: 1 })
        .expect(201);
      await http()
        .post(basket('/bespoke-items'))
        .send({ variantId: sienna, dimensions, choices: { ...smallest, FEET: 'Yes' } })
        .expect(201);
      const { body } = await http()
        .post(basket('/bespoke-items'))
        .send({
          variantId: linea,
          dimensions: { W: 1000, D: 1000, H: 500, L: 1000 },
          choices: smallest,
        })
        .expect(201);
      expect(body.lines.map((line: { unitPricePence: number }) => line.unitPricePence)).toEqual([
        102243, 106859, 95171,
      ]);

      const { body: quote } = await http()
        .post('/store/products/sienna-planter/bespoke-quote')
        .send({ dimensions, choices: smallest })
        .expect(200);
      expect(quote.pricePence).toBe(102243);
      await http()
        .post(basket('/bespoke-items'))
        .send({ variantId: sienna, dimensions: { W: 100, D: 1600, H: 900 }, choices: smallest })
        .expect(422);
    });

    it('2. asks for a colour from the set when a powder-coated option goes in the basket', async () => {
      const staff = await signIn(app, 'catalogue');
      const { body: set } = await http()
        .post('/admin/colour-sets')
        .set('authorization', staff)
        .send({ name: `Screens ${Date.now()}`, colours: [{ name: 'Jet black', hex: '#0A0A0A' }] })
        .expect(201);
      const { body: created } = await http()
        .post('/admin/products')
        .set('authorization', staff)
        .send({ title: `Woven screen ${Date.now()}` })
        .expect(201);
      const { id, attributes, pimSku, updatedAt, problems, ...product } = created;
      const finish = (value: string) => ({
        sku: `WS-${value.slice(0, 2).toUpperCase()}-${Date.now()}`,
        title: value,
        options: { Finish: value },
        pricePence: 9999,
        weightKg: 20,
        coverageM2: null,
        stockQuantity: 0,
        barcode: null,
      });
      const { body: screen } = await http()
        .put(`/admin/products/${id}`)
        .set('authorization', staff)
        .send({
          ...product,
          published: true,
          pageType: '1B',
          stockMode: 'made_to_order',
          leadTimeMinDays: 5,
          leadTimeMaxDays: 10,
          options: [{ title: 'Finish', values: ['Weathered', 'Powder coated'] }],
          colourSetId: set.id,
          colourOption: 'Finish',
          colourOptionValue: 'Powder coated',
          variants: [finish('Weathered'), finish('Powder coated')],
        })
        .expect(200);
      const [weathered, powder] = screen.variants;
      const black = set.colours[0].id;

      await http()
        .post(basket('/lines'))
        .send({ variantId: powder.id, quantity: 1 })
        .expect(422)
        .expect(({ body }) => expect(body.message).toBe('Choose a colour.'));
      await http()
        .post(basket('/lines'))
        .send({ variantId: weathered.id, quantity: 1, colourId: black })
        .expect(422)
        .expect(({ body }) =>
          expect(body.message).toBe("This option doesn't come in a choice of colour."),
        );
      const { body } = await http()
        .post(basket('/lines'))
        .send({ variantId: powder.id, quantity: 2, colourId: black })
        .expect(201);
      expect(body.lines[0]).toMatchObject({ colour: 'Jet black', quantity: 2 });
    });

    it('3. will not place a pallet order without a held day and lorry access answers', async () => {
      await palletBasket();
      const { body } = await http().post(basket('/complete')).send({}).expect(422);
      expect(body.message).toBe(
        'Choose a delivery day for your pallet delivery. Answer the delivery access questions.',
      );
      await http()
        .put(basket('/access'))
        .send({ ...access, vehicleAccess: 'tank' })
        .expect(400);
    });

    it('4. refuses to complete when the held day has lapsed', async () => {
      const days = await palletBasket();
      await http().put(basket('/delivery-day')).send({ date: days[0]?.date }).expect(200);
      await http().put(basket('/access')).send(access).expect(200);
      const holdId = await holdIdFor(basketId);
      await http().delete(`/delivery/slot-holds/${holdId}`).expect(204);

      const { body } = await http().post(basket('/complete')).send({}).expect(422);
      expect(body.message).toBe('We could not keep your delivery day. Choose a day again.');
    });
  });

  async function holdIdFor(id: string) {
    const { createDatabase } = await import('../src/database/client.js');
    const { baskets } = await import('../src/database/schema/index.js');
    const { eq } = await import('drizzle-orm');
    const { db, close } = createDatabase(databaseUrl);
    const [row] = await db.select({ slot: baskets.slot }).from(baskets).where(eq(baskets.id, id));
    await close();
    return row?.slot?.holdId;
  }

  it('places a pallet order once, books the held day and shows it to staff with the answers', async () => {
    const days = await palletBasket();
    const { body: options } = await http().get(basket('/delivery-options')).expect(200);
    expect(options).toEqual([
      expect.objectContaining({ shipment: 'pallet', pricePence: 6500, problem: null }),
      expect.objectContaining({
        shipment: 'parcel',
        pricePence: null,
        problem: 'Too heavy to send as a parcel.',
      }),
    ]);
    await http().put(basket('/delivery-day')).send({ date: '2030-01-01' }).expect(422);
    await http().put(basket('/delivery-day')).send({ date: days[1]?.date }).expect(200);
    await http().put(basket('/access')).send(access).expect(200);

    const { body: payment } = await http().post(basket('/payment')).expect(200);
    expect(payment).toEqual({
      provider: 'test',
      clientSecret: null,
      amountPence: 40 * 3999 + 6500,
    });

    const { body: placed } = await http().post(basket('/complete')).send({}).expect(200);
    const { body: again } = await http().post(basket('/complete')).send({}).expect(200);
    expect(again.orderId).toBe(placed.orderId);
    await http()
      .post(basket('/lines'))
      .send({ variantId: await variantOf('pavetuf-jointing-compound'), quantity: 1 })
      .expect(422);

    await app.get(JobQueue).drain();
    const { body: order } = await http().get(`/store/orders/${placed.orderId}`).expect(200);
    expect(order.delivery).toEqual({
      shipment: 'pallet',
      name: 'Pallet delivery on a day you choose',
      day: { date: days[1]?.date, status: 'booked' },
      access,
    });
    expect(order.totalPence).toBe(40 * 3999 + 6500);

    const staff = await signIn(app, 'catalogue');
    const { body: list } = await http()
      .get('/admin/orders')
      .set('authorization', staff)
      .expect(200);
    expect(list[0]).toMatchObject({ id: placed.orderId, day: days[1]?.date, dayStatus: 'booked' });
    const editor = await signIn(app, 'editor');
    await http().get('/admin/orders').set('authorization', editor).expect(403);

    const { body: refunded } = await http()
      .post(`/admin/orders/${placed.orderId}/refunds`)
      .set('authorization', staff)
      .send({ amountPence: 6500 })
      .expect(200);
    expect(refunded.payment).toEqual({
      provider: 'test',
      status: 'partly_refunded',
      refundedPence: 6500,
    });
    await http()
      .post(`/admin/orders/${placed.orderId}/refunds`)
      .set('authorization', staff)
      .send({ amountPence: 40 * 3999 + 1 })
      .expect(422);
  });

  it('says how much of a part-stocked line ships now and how much is made to order', async () => {
    const slabs = await variantOf('silver-grey-porcelain-paving');
    const { body } = await http()
      .post(basket('/lines'))
      .send({ variantId: slabs, quantity: 14 })
      .expect(201);
    expect(body.lines[0].stock).toBe('12 now, 2 made to order');
  });

  it('keeps the same product in two colours as two lines, and the lines of a build together', async () => {
    const grey = await variantOf('pavetuf-jointing-compound', 0);
    const buff = await variantOf('pavetuf-jointing-compound', 1);
    await http().post(basket('/lines')).send({ variantId: grey, quantity: 1 }).expect(201);
    await http().post(basket('/lines')).send({ variantId: grey, quantity: 2 }).expect(201);
    const { body } = await http()
      .post(basket('/builds'))
      .send({
        parts: [
          { variantId: grey, quantity: 2, side: 'left' },
          { variantId: grey, quantity: 1, side: 'right' },
          { variantId: buff, quantity: 1 },
        ],
      })
      .expect(201);
    expect(
      body.lines.map((line: { quantity: number; buildId: string | null }) => [
        line.quantity,
        Boolean(line.buildId),
      ]),
    ).toEqual([
      [3, false],
      [3, true],
      [1, true],
    ]);
    expect(new Set(body.lines.slice(1).map((line: { buildId: string }) => line.buildId))).toEqual(
      new Set([body.buildId]),
    );
  });
});
