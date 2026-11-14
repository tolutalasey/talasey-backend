import { readdir, readFile } from 'node:fs/promises';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobQueue } from '../src/jobs/job-queue.js';
import { databaseUrl, signIn, startApi } from './support/app.js';

const address = {
  firstName: 'Sam',
  lastName: 'Ples',
  address1: '1 Piccadilly',
  city: 'Manchester',
  postcode: 'm11ae',
};

describe.skipIf(!databaseUrl)('free samples', () => {
  let app: NestExpressApplication;
  let staff: string;
  let editor: string;
  const http = () => request(app.getHttpServer());
  const offers = async () =>
    (await http().get('/store/samples/offers').expect(200)).body as { id: string; label: string }[];

  beforeAll(async () => {
    app = await startApi();
    staff = await signIn(app, 'catalogue');
    editor = await signIn(app, 'editor');
  });

  afterAll(() => app?.close());

  it('takes a request for up to five samples and emails the customer', async () => {
    const [first, second] = await offers();
    const email = `samples-${Date.now()}@example.com`;
    const { body } = await http()
      .post('/store/samples')
      .send({ email, address, offerIds: [first?.id, second?.id] })
      .expect(201);
    expect(body.number).toBeGreaterThan(0);

    await app.get(JobQueue).drain();
    const outbox = '.data/outbox';
    const files = await readdir(outbox);
    const sent = await Promise.all(files.map((file) => readFile(`${outbox}/${file}`, 'utf8')));
    expect(sent.find((mail) => mail.includes(email))).toContain(`#S${body.number}`);
  });

  it('refuses more than five, the same sample twice, and a postcode outside the UK', async () => {
    const [first] = await offers();
    const send = (offerIds: unknown[], postcode = 'M1 1AE') =>
      http()
        .post('/store/samples')
        .send({ email: 'a@example.com', address: { ...address, postcode }, offerIds });
    await send(Array.from({ length: 6 }, () => crypto.randomUUID())).expect(400);
    await send([first?.id, first?.id]).expect(400);
    const { body } = await send([first?.id], '75001').expect(400);
    expect(JSON.stringify(body)).toMatch(/postcode/i);
  });

  it('lets staff stop offering a sample, and the shop stops showing it', async () => {
    const created = await http()
      .post('/admin/samples/offers')
      .set('authorization', staff)
      .send({ productHandle: 'silver-grey-porcelain-paving', label: `Test ${Date.now()}` })
      .expect(201);
    expect((await offers()).map((offer) => offer.id)).toContain(created.body.id);

    await http()
      .patch(`/admin/samples/offers/${created.body.id}`)
      .set('authorization', staff)
      .send({ active: false })
      .expect(204);
    expect((await offers()).map((offer) => offer.id)).not.toContain(created.body.id);

    await http()
      .post('/admin/samples/offers')
      .set('authorization', staff)
      .send({ productHandle: 'no-such-product', label: 'Grey' })
      .expect(422);
  });

  it('marks a request as sent once, for staff who handle orders', async () => {
    await http().get('/admin/samples/requests').set('authorization', editor).expect(403);
    const [offer] = await offers();
    const { body: placed } = await http()
      .post('/store/samples')
      .send({ email: 'b@example.com', address, offerIds: [offer?.id] })
      .expect(201);
    const { body: waiting } = await http()
      .get('/admin/samples/requests?status=new')
      .set('authorization', staff)
      .expect(200);
    const mine = waiting.find((entry: { number: number }) => entry.number === placed.number);

    const { body: sent } = await http()
      .post(`/admin/samples/requests/${mine.id}/dispatch`)
      .set('authorization', staff)
      .expect(200);
    expect(sent).toMatchObject({ status: 'dispatched', dispatchedBy: 'Cat Catalogue' });
    await http()
      .post(`/admin/samples/requests/${mine.id}/dispatch`)
      .set('authorization', staff)
      .expect(404);
  });
});
