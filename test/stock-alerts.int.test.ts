import { readdir, readFile } from 'node:fs/promises';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobQueue } from '../src/jobs/job-queue.js';
import { databaseUrl, signIn, startApi } from './support/app.js';

interface AdminProduct {
  id: string;
  stockMode: string;
  variants: { id: string; stockQuantity: number }[];
  [field: string]: unknown;
}

describe.skipIf(!databaseUrl)('back in stock emails', () => {
  let app: NestExpressApplication;
  let staff: string;
  let product: AdminProduct;
  const http = () => request(app.getHttpServer());

  const setStock = async (quantity: number, stockMode = product.stockMode) => {
    const { id, attributes, pimSku, updatedAt, problems, ...input } = product;
    void [attributes, pimSku, updatedAt, problems];
    const variants = product.variants.map((variant) => ({ ...variant, stockQuantity: quantity }));
    await http()
      .put(`/admin/products/${id}`)
      .set('authorization', staff)
      .send({ ...input, stockMode, variants })
      .expect(200);
    await app.get(JobQueue).drain();
  };

  beforeAll(async () => {
    app = await startApi();
    staff = await signIn(app, 'catalogue');
    const { body: list } = await http()
      .get('/admin/products?search=Silver grey porcelain')
      .set('authorization', staff)
      .expect(200);
    const { body } = await http()
      .get(`/admin/products/${list[0].id}`)
      .set('authorization', staff)
      .expect(200);
    product = body;
  });

  afterAll(async () => {
    if (product) await setStock(12);
    await app?.close();
  });

  it('says it can be bought now when it is in stock', async () => {
    await setStock(12);
    const { body } = await http()
      .post('/store/stock-alerts')
      .send({ variantId: product.variants[0]?.id, email: 'now@example.com' })
      .expect(200);
    expect(body.status).toBe('available');
  });

  it('emails once, when the option is back in stock', async () => {
    await setStock(0, 'stocked');
    const email = `back-${Date.now()}@example.com`;
    for (let ask = 0; ask < 2; ask++) {
      const { body } = await http()
        .post('/store/stock-alerts')
        .send({ variantId: product.variants[0]?.id, email })
        .expect(200);
      expect(body.status).toBe('waiting');
    }

    await setStock(5, 'stocked');
    await setStock(6, 'stocked');
    const outbox = '.data/outbox';
    const mails = await Promise.all(
      (await readdir(outbox)).map((file) => readFile(`${outbox}/${file}`, 'utf8')),
    );
    const sent = mails.filter((mail) => mail.includes(email));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('/products/silver-grey-porcelain-paving/');
  });

  it('takes no requests for made-to-order options, which can always be bought', async () => {
    await setStock(0, 'made_to_order');
    const { body } = await http()
      .post('/store/stock-alerts')
      .send({ variantId: product.variants[0]?.id, email: 'mto@example.com' })
      .expect(200);
    expect(body.status).toBe('available');
  });

  it('refuses an option that is not on sale', async () => {
    await http()
      .post('/store/stock-alerts')
      .send({ variantId: crypto.randomUUID(), email: 'a@example.com' })
      .expect(404);
  });
});
