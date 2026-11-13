import { describe, expect, it } from 'vitest';
import { readWorkbook } from '../import/xlsx.js';
import type { CatalogueProduct } from '../product.js';
import { catalogueRows, EXPORT_HEADINGS } from './catalogue-export.js';
import { writeWorkbook } from './xlsx-writer.js';

const product = (title: string, overrides: Partial<CatalogueProduct> = {}): CatalogueProduct =>
  ({
    id: title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    title,
    published: true,
    pageType: '1A',
    stockMode: 'stocked_then_made_to_order',
    leadTimeMinDays: 5,
    leadTimeMaxDays: 10,
    category: { handle: 'paving', name: 'Paving' },
    variants: [
      {
        id: `${title}-1`,
        sku: 'PAV-600',
        title: '600 × 600 mm',
        options: { Size: '600 × 600 mm', Finish: 'Matt' },
        pricePence: 8999,
        weightKg: 42.5,
        coverageM2: 1.44,
        stockQuantity: 12,
        barcode: null,
      },
    ],
    ...overrides,
  }) as CatalogueProduct;

describe('catalogue export', () => {
  it('has one row per option, sorted by product, with prices in pounds', () => {
    const rows = catalogueRows([product('Zinc edging'), product('Ash paving')]);
    expect(rows[0]).toEqual([...EXPORT_HEADINGS]);
    expect(rows[1]).toEqual([
      'Ash paving',
      '/products/ash-paving/',
      '1A',
      true,
      'Paving',
      'PAV-600',
      '600 × 600 mm, Matt',
      89.99,
      12,
      'stocked then made to order',
      '5-10',
      42.5,
      1.44,
      null,
    ]);
    expect(rows[2]?.[0]).toBe('Zinc edging');
  });

  it('writes a workbook that reads back the same, special characters included', () => {
    const rows = [
      ['Name', 'Price', 'Live'],
      ['Sienna planter <bespoke> & "made to measure"', 1022.43, true],
      ['Empty price', null, false],
    ];
    const read = readWorkbook(writeWorkbook('Catalogue', rows));
    expect(read.sheetNames).toEqual(['Catalogue']);
    expect(read.rows('Catalogue')).toEqual([
      ['Name', 'Price', 'Live'],
      ['Sienna planter <bespoke> & "made to measure"', '1022.43', '1'],
      ['Empty price', null, '0'],
    ]);
  });
});
