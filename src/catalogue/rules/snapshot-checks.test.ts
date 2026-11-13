import { describe, expect, it } from 'vitest';
import { colourSetProblems, productCatalogueProblems } from './snapshot-checks.js';
import type { ColourImageSnapshot, ProductCatalogueSnapshot } from './snapshots.js';

describe('colourSetProblems', () => {
  it('passes a named set of distinct colours with hex values', () => {
    expect(
      colourSetProblems({
        name: 'Standard powder coat',
        colours: [
          { name: 'Anthracite grey', hex: '#383E42', photo_url: null },
          { name: 'Jet black', hex: '#0a0a0a', photo_url: null },
        ],
      }),
    ).toEqual([]);
  });

  it('says what is wrong in plain words', () => {
    expect(
      colourSetProblems({
        name: ' ',
        colours: [
          { name: 'Jet black', hex: 'black', photo_url: null },
          { name: 'jet black', hex: '#0A0A0A', photo_url: null },
        ],
      }),
    ).toEqual([
      'Give the colour set a name',
      'Jet black needs a hex value like #383E42',
      'jet black is in the set twice',
    ]);
  });
});

describe('productCatalogueProblems', () => {
  const product: ProductCatalogueSnapshot = {
    page_type: '1B',
    stock_mode: 'made_to_order',
    lead_time_min_days: 15,
    lead_time_max_days: 20,
    colour_rule: {
      colour_set_id: 'colset_1',
      option: 'Finish',
      value: 'Powder coated',
      required: true,
    },
    images: [
      {
        size: '1800 × 300 mm',
        finish: 'Powder coated',
        colour_id: 'col_1',
        url: 'https://x/1.jpg',
        alt: 'Anthracite screen',
      },
    ],
  };
  const colours = new Set(['col_1']);

  it('passes a complete 1B product', () => {
    expect(productCatalogueProblems(product, colours)).toEqual([]);
  });

  it('needs a lead time for anything made to order', () => {
    expect(
      productCatalogueProblems(
        { ...product, lead_time_min_days: null, lead_time_max_days: null },
        colours,
      ),
    ).toEqual(['Made-to-order products need a lead time']);
  });

  it('leaves products that have not been set up alone, so their old state can be restored', () => {
    expect(
      productCatalogueProblems(
        {
          ...product,
          page_type: null,
          stock_mode: 'stocked_then_made_to_order',
          lead_time_min_days: null,
          lead_time_max_days: null,
          colour_rule: null,
          images: [],
        },
        colours,
      ),
    ).toEqual([]);
  });

  it('rejects a lead time that runs backwards', () => {
    expect(productCatalogueProblems({ ...product, lead_time_max_days: 10 }, colours)).toEqual([
      'The lead time runs from a shorter number of days to a longer one',
    ]);
  });

  it('keeps colour sets to page types 1B and 2', () => {
    expect(productCatalogueProblems({ ...product, page_type: '1A' }, colours)).toEqual([
      'Only page types 1B and 2 use a colour set',
    ]);
  });

  it('checks images use colours from the set and have alt text', () => {
    expect(
      productCatalogueProblems(
        {
          ...product,
          images: [{ ...(product.images[0] as ColourImageSnapshot), colour_id: 'col_9', alt: '' }],
        },
        colours,
      ),
    ).toEqual([
      "The 1800 × 300 mm Powder coated image uses a colour that isn't in the set",
      'The 1800 × 300 mm Powder coated image needs alt text',
    ]);
  });
});
