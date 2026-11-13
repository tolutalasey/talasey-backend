import { describe, expect, it } from 'vitest';
import { sienna } from '../bespoke/planters.js';
import type { ProductState } from '../product.js';
import { productProblems } from './product-problems.js';

const product: ProductState = {
  handle: 'silver-grey-porcelain-paving',
  title: 'Silver grey porcelain paving',
  subtitle: null,
  description: null,
  brand: null,
  published: true,
  pageType: '1A',
  stockMode: 'stocked',
  leadTimeMinDays: null,
  leadTimeMaxDays: null,
  categoryId: null,
  options: [{ title: 'Size', values: ['600 × 600 mm'] }],
  colourSetId: null,
  colourOption: null,
  colourOptionValue: null,
  colourRequired: true,
  colourLabel: null,
  bespoke: null,
  attributes: {},
  pimSku: null,
  variants: [
    {
      id: 'v1',
      sku: 'POR-SLV-600',
      title: '600 × 600 mm',
      options: { Size: '600 × 600 mm' },
      pricePence: 8999,
      weightKg: 70,
      coverageM2: 1.44,
      stockQuantity: 12,
      barcode: null,
    },
  ],
  images: [{ url: '/uploads/slab.jpg', alt: 'Silver grey slabs laid on a patio' }],
  colourImages: [],
};

describe('productProblems', () => {
  it('passes a complete product', () => {
    expect(productProblems(product, new Set())).toEqual([]);
  });

  it('checks the web address, photos and option values', () => {
    expect(
      productProblems(
        {
          ...product,
          handle: 'Silver Grey!',
          images: [{ url: '/x.jpg', alt: ' ' }],
          variants: [
            {
              ...(product.variants[0] as ProductState['variants'][number]),
              options: { Size: '900 mm' },
            },
          ],
        },
        new Set(),
      ),
    ).toEqual([
      'The web address can only use lower-case letters, numbers and hyphens',
      'Every photo needs a description (alt text)',
      "600 × 600 mm uses Size: 900 mm, which the product doesn't offer",
    ]);
  });

  it('needs a price formula on made-to-measure products only', () => {
    expect(productProblems({ ...product, pageType: '2' }, new Set())).toContain(
      'Made-to-measure products need their sizes and price formula',
    );
    expect(productProblems({ ...product, pageType: '2', bespoke: sienna }, new Set())).toEqual([]);
    expect(productProblems({ ...product, bespoke: sienna }, new Set())).toEqual([
      'Only made-to-measure products (page type 2) have a price formula',
    ]);
  });

  it('needs a lead time for made-to-order products', () => {
    expect(productProblems({ ...product, stockMode: 'made_to_order' }, new Set())).toEqual([
      'Made-to-order products need a lead time',
    ]);
  });
});
