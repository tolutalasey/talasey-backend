import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleFor, MasterSheetError, MasterSheetPimSource, toSnapshot } from './master-sheet.js';
import { summarise, type PimProduct } from './pim-source.js';
import { heldBackRows, productRows } from './sheet-fixture.js';

describe('toSnapshot', () => {
  const snapshot = toSnapshot(productRows, heldBackRows);

  it('groups options under their parent and keeps single products as one variant', () => {
    expect(snapshot.products.map((product) => [product.sku, product.variants.length])).toEqual([
      ['P-SCREEN-ABSTRACT', 3],
      ['EDWOWO250', 1],
      ['PTEDINST', 1],
    ]);
  });

  it('maps a product with options', () => {
    const [screen] = snapshot.products as [PimProduct];
    expect(screen).toMatchObject({
      handle: 'abstract-branches-decorative-screen',
      title: 'Abstract Branches Decorative Screen',
      published: true,
      categoryPath: ['Architectural Steelwork', 'Screens'],
      options: [
        { title: 'Size', values: ['1800 × 300 mm', '1800 × 600 mm'] },
        { title: 'Finish', values: ['Weathered Steel', 'Powder Coated'] },
      ],
      attributes: { template: 'one', colour_set: 'standard_powder_coat_colours' },
    });
    expect(screen.variants[0]).toEqual({
      sku: 'SCRAB1800-300C',
      title: '1800 × 300 mm / Weathered Steel',
      options: { Size: '1800 × 300 mm', Finish: 'Weathered Steel' },
      priceIncVat: 79.99,
      weightKg: null,
    });
  });

  it('leaves a missing price empty rather than zero', () => {
    expect(snapshot.products[1]?.variants[0]?.priceIncVat).toBeNull();
    expect(snapshot.products[1]?.published).toBe(false);
  });

  it('counts products, SKUs, held-back rows and missing prices', () => {
    expect(summarise(snapshot)).toEqual({
      rows: 7,
      products: 3,
      withVariants: 1,
      single: 2,
      skus: 5,
      heldBack: 2,
      unpriced: 2,
      heldBackReasons: {
        'No SKU. Every product needs a unique SKU before it can be imported.': 1,
        "Hidden: pergolas go on the build-your-own (template 4) page, which isn't built yet.": 1,
      },
    });
  });

  it('keeps handles unique when two products share a name', () => {
    const edging = productRows[4] as (typeof productRows)[number];
    const twins = toSnapshot([edging, { ...edging, SKU: 'EDWOWO250-B' }], []);
    expect(twins.products.map((product) => product.handle)).toEqual([
      'woven-steel-connector-bracket-250mm',
      'woven-steel-connector-bracket-250mm-edwowo250-b',
    ]);
  });

  it('refuses options whose parent is missing', () => {
    expect(() => toSnapshot(productRows.slice(1), [])).toThrow(MasterSheetError);
  });
});

describe('handleFor', () => {
  it('makes a URL-safe handle', () => {
    expect(handleFor('Woven Steel 90° Corner Bracket - 250mm')).toBe(
      'woven-steel-90-corner-bracket-250mm',
    );
    expect(handleFor('Screen 1800 × 300 mm')).toBe('screen-1800-x-300-mm');
  });
});

// The real sheet stays out of git. Copy it to .data/pim to check the counts agreed with Amy.
const realSheet = fileURLToPath(
  new URL('../../../.data/pim/Talasey_Product_Master_Sheet_filled.xlsx', import.meta.url),
);

(existsSync(realSheet) ? describe : describe.skip)('the product master sheet', () => {
  it('matches the agreed counts', async () => {
    const summary = summarise(await new MasterSheetPimSource(realSheet).snapshot());
    expect(summary).toMatchObject({
      rows: 590,
      products: 171,
      withVariants: 54,
      single: 117,
      skus: 437,
      heldBack: 153,
      unpriced: 301,
    });
  });
});
