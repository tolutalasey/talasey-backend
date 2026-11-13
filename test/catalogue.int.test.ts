import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogueImporter } from '../src/catalogue/import/catalogue-import.js';
import { MasterSheetPimSource, toSnapshot } from '../src/catalogue/import/master-sheet.js';
import { summarise } from '../src/catalogue/import/pim-source.js';
import { heldBackRows, productRows } from '../src/catalogue/import/sheet-fixture.js';
import { seed } from '../src/database/seed.js';
import { databaseUrl, signIn, startApi } from './support/app.js';
import { resetCatalogue } from './support/reset.js';

const realSheet = fileURLToPath(
  new URL('../.data/pim/Talasey_Product_Master_Sheet_filled.xlsx', import.meta.url),
);

describe.skipIf(!databaseUrl)('catalogue', () => {
  let app: NestExpressApplication;
  let staff: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetCatalogue(databaseUrl);
    app = await startApi();
    await seed(databaseUrl, { demo: true });
    staff = await signIn(app, 'catalogue');
  });

  afterAll(() => app?.close());

  const productId = async (handle: string) => {
    const { body } = await http().get(`/store/products/${handle}`).expect(200);
    return body.id as string;
  };

  describe('editing in the admin', () => {
    it('keeps the catalogue to catalogue staff', async () => {
      const editor = await signIn(app, 'editor');
      await http().get('/admin/products').set('authorization', editor).expect(403);
      await http().get('/admin/products').expect(401);
    });

    it('changes a price and a photo, and the shop shows them straight away', async () => {
      const id = await productId('silver-grey-porcelain-paving');
      await http().get('/store/products').expect(200);

      const { body: product } = await http()
        .get(`/admin/products/${id}`)
        .set('authorization', staff)
        .expect(200);
      const { id: _id, attributes, pimSku, updatedAt, problems, ...input } = product;
      input.variants[0].pricePence = 9499;
      input.images = [{ url: '/uploads/silver-grey.jpg', alt: 'Silver grey slabs on a patio' }];
      await http().put(`/admin/products/${id}`).set('authorization', staff).send(input).expect(200);

      const { body: shown } = await http().get('/store/products/silver-grey-porcelain-paving');
      expect(shown.variants[0].pricePence).toBe(9499);
      expect(shown.thumbnail).toBe('/uploads/silver-grey.jpg');
    });

    it('explains what to fix instead of saving a broken product', async () => {
      const id = await productId('pavetuf-jointing-compound');
      const { body: product } = await http()
        .get(`/admin/products/${id}`)
        .set('authorization', staff);
      const { id: _id, attributes, pimSku, updatedAt, problems, ...input } = product;
      const { body } = await http()
        .put(`/admin/products/${id}`)
        .set('authorization', staff)
        .send({ ...input, leadTimeMinDays: null, leadTimeMaxDays: null })
        .expect(422);
      expect(body.message).toContain('Made-to-order products need a lead time');
    });

    it('puts the old price back from the catalogue log', async () => {
      const id = await productId('silver-grey-porcelain-paving');
      const { body: log } = await http()
        .get('/admin/audit')
        .query({ subject: 'product', subjectId: id })
        .set('authorization', staff)
        .expect(200);
      expect(log[0].actorName).toBe('Cat Catalogue');
      await http()
        .post(`/admin/audit/${log[0].id}/restore`)
        .set('authorization', staff)
        .expect(200);
      const { body: shown } = await http().get('/store/products/silver-grey-porcelain-paving');
      expect(shown.variants[0].pricePence).toBe(8999);
    });
  });

  describe('colour sets', () => {
    it('creates a set, will not delete it while a product uses it, and restores a deleted one', async () => {
      const { body: set } = await http()
        .post('/admin/colour-sets')
        .set('authorization', staff)
        .send({
          name: 'Planter colours',
          colours: [
            { name: 'Anthracite grey', hex: '#383E42' },
            { name: 'Jet black', hex: '#0A0A0A' },
          ],
        })
        .expect(201);
      expect(set.colours.map((colour: { name: string }) => colour.name)).toEqual([
        'Anthracite grey',
        'Jet black',
      ]);

      await http()
        .post('/admin/colour-sets')
        .set('authorization', staff)
        .send({ name: 'Bad', colours: [{ name: 'Black', hex: 'black' }] })
        .expect(422);

      const id = await productId('sienna-planter');
      const { body: product } = await http()
        .get(`/admin/products/${id}`)
        .set('authorization', staff);
      const { id: _id, attributes, pimSku, updatedAt, problems, ...input } = product;
      await http()
        .put(`/admin/products/${id}`)
        .set('authorization', staff)
        .send({ ...input, colourSetId: set.id })
        .expect(200);
      await http().delete(`/admin/colour-sets/${set.id}`).set('authorization', staff).expect(409);

      const { body: offer } = await http().get(`/store/products/${id}/colours`).expect(200);
      expect(offer.colours).toHaveLength(2);

      await http()
        .put(`/admin/products/${id}`)
        .set('authorization', staff)
        .send({ ...input, colourSetId: null })
        .expect(200);
      await http().delete(`/admin/colour-sets/${set.id}`).set('authorization', staff).expect(204);
      const { body: log } = await http()
        .get('/admin/audit')
        .query({ subject: 'colour_set', subjectId: set.id })
        .set('authorization', staff);
      await http()
        .post(`/admin/audit/${log[0].id}/restore`)
        .set('authorization', staff)
        .expect(200);
      const { body: back } = await http()
        .get(`/admin/colour-sets/${set.id}`)
        .set('authorization', staff);
      expect(back.colours.map((colour: { id: string }) => colour.id)).toEqual(
        set.colours.map((colour: { id: string }) => colour.id),
      );
    });
  });

  describe('importing the product sheet', () => {
    it('imports products, options, prices and colour sets, then changes nothing on a second run', async () => {
      const importer = app.get(CatalogueImporter);
      const snapshot = toSnapshot(productRows, heldBackRows, [
        { key: 'standard_powder_coat_colours', colours: [{ name: 'Jet black', code: 'RAL 9005' }] },
      ]);

      const dry = await importer.run(snapshot, { dryRun: true });
      expect(dry).toMatchObject({ dryRun: true, created: 3, colourSetsCreated: 1 });
      await http()
        .get('/admin/products?search=Abstract')
        .set('authorization', staff)
        .expect(200, []);

      expect(await importer.run(snapshot)).toMatchObject({ created: 3, profilesCreated: 1 });
      expect(await importer.run(snapshot)).toMatchObject({ created: 0, updated: 0, unchanged: 3 });

      const { body: screen } = await http()
        .get('/store/products/abstract-branches-decorative-screen')
        .expect(200);
      expect(screen).toMatchObject({ pageType: '1B', colourChoice: { option: 'Finish' } });
      expect(screen.variants.map((v: { pricePence: number | null }) => v.pricePence)).toEqual([
        7999,
        11999,
        null,
      ]);
    });

    it('updates a product already in the catalogue from the sheet, matched by SKU', async () => {
      const importer = app.get(CatalogueImporter);
      const renamed = productRows.map((row) =>
        row.SKU === 'SCRAB1800-300C' ? { ...row, 'Regular price': '84.99' } : row,
      );
      const result = await importer.run(toSnapshot(renamed, heldBackRows, []));
      expect(result).toMatchObject({ created: 0, updated: 1 });
      const { body } = await http().get('/store/products/abstract-branches-decorative-screen');
      expect(body.variants[0].pricePence).toBe(8499);
    });

    it('reports SKU problems such as codes in names', async () => {
      await http()
        .post('/admin/products')
        .set('authorization', staff)
        .send({ title: 'Corner bracket SCRDL1800-600PC' })
        .expect(201);
      const { body } = await http()
        .get('/admin/catalogue/sku-checks')
        .set('authorization', staff)
        .expect(200);
      expect(body).toContainEqual(
        expect.objectContaining({
          rule: 'code-in-name',
          productTitle: 'Corner bracket SCRDL1800-600PC',
        }),
      );
    });

    it.skipIf(!existsSync(realSheet))(
      'imports the real master sheet to the agreed counts',
      async () => {
        await resetCatalogue(databaseUrl);
        const source = new MasterSheetPimSource(realSheet);
        const snapshot = await source.snapshot();
        expect(summarise(snapshot)).toMatchObject({
          rows: 590,
          products: 171,
          withVariants: 54,
          single: 117,
          skus: 437,
          heldBack: 153,
          unpriced: 301,
        });
        const importer = app.get(CatalogueImporter);
        expect(await importer.run(snapshot)).toMatchObject({ created: 171, profilesCreated: 20 });
        expect(await importer.run(snapshot)).toMatchObject({
          created: 0,
          updated: 0,
          unchanged: 171,
        });
      },
    );
  });
});
