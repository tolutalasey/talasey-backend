import { describe, expect, it } from 'vitest';
import { checkSkus, type CheckedProduct } from './sku-checks.js';

const screen = (overrides: Partial<CheckedProduct> = {}): CheckedProduct => ({
  id: 'prod_screen',
  title: 'Abstract Branches decorative screen',
  pageType: '1B',
  options: ['Size', 'Finish'],
  variants: [
    { id: 'v1', sku: 'SCRAB1800-300C', title: '1800 × 300 mm / Weathered steel' },
    { id: 'v2', sku: 'SCRAB1800-300PC', title: '1800 × 300 mm / Powder coated' },
  ],
  ...overrides,
});

const rules = (products: CheckedProduct[]) => checkSkus(products).map((problem) => problem.rule);

describe('checkSkus', () => {
  it('passes a well-formed 1B product', () => {
    expect(checkSkus([screen()])).toEqual([]);
  });

  it('finds a SKU used twice, even across products', () => {
    const edging = {
      ...screen({ id: 'prod_edging', title: 'Weave edging', pageType: '1A' }),
      variants: [{ id: 'v9', sku: 'SCRAB1800-300C', title: '250 mm' }],
    };
    expect(checkSkus([screen(), edging]).filter((p) => p.rule === 'duplicate-sku')).toEqual([
      expect.objectContaining({ productId: 'prod_screen', variantId: 'v1' }),
      expect.objectContaining({ productId: 'prod_edging', variantId: 'v9' }),
    ]);
  });

  it('flags a variant without a SKU', () => {
    expect(rules([screen({ variants: [{ id: 'v1', sku: null, title: 'Large' }] })])).toEqual([
      'missing-sku',
    ]);
  });

  it('keeps colour out of SKUs and options on 1B products', () => {
    expect(
      rules([
        screen({
          options: ['Size', 'Finish', 'Colour'],
          variants: [{ id: 'v1', sku: 'SCRAB1800-300PCAN', title: '1800 × 300 mm / Anthracite' }],
        }),
      ]),
    ).toEqual(['colour-option', 'colour-in-sku']);
  });

  it('allows a colour option on 1A products, where every colour is its own SKU', () => {
    expect(rules([screen({ pageType: '1A', options: ['Colour'] })])).toEqual([]);
  });

  it('keeps product codes out of names', () => {
    expect(
      rules([
        screen({
          title: 'SCRAB1800 Abstract screen',
          variants: [{ id: 'v1', sku: 'EDWOWO250', title: 'EDWOWO250 250mm' }],
        }),
      ]),
    ).toEqual(['code-in-name', 'code-in-name']);
  });
});
