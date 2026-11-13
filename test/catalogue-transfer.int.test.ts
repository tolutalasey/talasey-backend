import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXPORT_HEADINGS } from '../src/catalogue/export/catalogue-export.js';
import { readWorkbook } from '../src/catalogue/import/xlsx.js';
import { databaseUrl, signIn, startApi } from './support/app.js';

const realSheet = fileURLToPath(
  new URL('../.data/pim/Talasey_Product_Master_Sheet_filled.xlsx', import.meta.url),
);

describe.skipIf(!databaseUrl)('catalogue import and export in the admin', () => {
  let app: NestExpressApplication;
  let catalogue: string;
  let editor: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await startApi();
    catalogue = await signIn(app, 'catalogue');
    editor = await signIn(app, 'editor');
  });

  afterAll(() => app?.close());

  it('keeps import and export to catalogue staff', async () => {
    await http().get('/admin/catalogue/export').set('authorization', editor).expect(403);
  });

  it('exports every option as a workbook', async () => {
    const response = await http()
      .get('/admin/catalogue/export')
      .set('authorization', catalogue)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(response.headers['content-disposition']).toMatch(/talasey-catalogue-.*\.xlsx/);
    const rows = readWorkbook(response.body as Buffer).rows('Catalogue');
    expect(rows[0]).toEqual([...EXPORT_HEADINGS]);
    expect(rows.length).toBeGreaterThan(1);
  });

  it('turns away a file that is not the master sheet', async () => {
    const { body } = await http()
      .post('/admin/catalogue/import')
      .set('authorization', catalogue)
      .attach('file', Buffer.from('name,price\nslab,10\n'), 'products.csv')
      .expect(422);
    expect(body.message).toContain('not an .xlsx workbook');
  });

  it.skipIf(!existsSync(realSheet))(
    'checks the uploaded master sheet without changing anything, then imports it',
    async () => {
      const check = await http()
        .post('/admin/catalogue/import')
        .set('authorization', catalogue)
        .attach('file', realSheet)
        .expect(200);
      expect(check.body.applied).toBe(false);
      expect(check.body.report[0]).toContain('590 rows, 171 products');
      expect(check.body.report.join('\n')).toMatch(/^Would /m);

      const applied = await http()
        .post('/admin/catalogue/import?apply=true')
        .set('authorization', catalogue)
        .attach('file', realSheet)
        .expect(200);
      expect(applied.body.applied).toBe(true);
      expect(applied.body.report.join('\n')).toMatch(/^Did /m);
    },
  );
});
