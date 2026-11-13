import { describe, expect, it } from 'vitest';
import {
  NEW_OPTION_VALUE,
  planImport,
  type ExistingProduct,
  type ProductChange,
} from './import-plan.js';
import { toSnapshot } from './master-sheet.js';
import type { PimProduct } from './pim-source.js';
import { heldBackRows, productRows } from './sheet-fixture.js';

const [screen, bracket] = toSnapshot(productRows, heldBackRows).products as [
  PimProduct,
  PimProduct,
];
const CATEGORY = 'pcat_screens';
const categoryIdFor = () => CATEGORY;

function asImported(overrides: Partial<ExistingProduct> = {}): ExistingProduct {
  return {
    id: 'prod_screen',
    handle: screen.handle,
    title: screen.title,
    subtitle: screen.subtitle,
    description: screen.description,
    metadata: { pim_sku: screen.sku, pim: screen.attributes },
    categoryIds: [CATEGORY],
    options: screen.options,
    variants: screen.variants.map((variant, index) => ({
      id: `variant_${index}`,
      sku: variant.sku,
      title: variant.title,
      weightKg: variant.weightKg,
      priceIncVat: variant.priceIncVat,
      options: variant.options,
    })),
    ...overrides,
  };
}

describe('planImport', () => {
  it('creates products that are not in the catalogue yet', () => {
    const plan = planImport([screen, bracket], [], categoryIdFor);
    expect(plan.create.map((product) => product.handle)).toEqual([screen.handle, bracket.handle]);
    expect(plan.update).toEqual([]);
  });

  it('leaves a product alone when nothing has changed, so a second run does nothing', () => {
    expect(planImport([screen], [asImported()], categoryIdFor)).toEqual({
      create: [],
      update: [],
      unchanged: [screen.handle],
      skipped: [],
    });
  });

  it('updates the product fields that changed and keeps metadata set in the admin', () => {
    const existing = asImported({
      title: 'Old name',
      metadata: { pim_sku: screen.sku, pim: screen.attributes, brand: 'Talasey' },
    });
    const [change] = planImport([screen], [existing], categoryIdFor).update as [ProductChange];
    expect(change.fields).toEqual({
      title: screen.title,
      subtitle: screen.subtitle,
      description: screen.description,
      metadata: { pim_sku: screen.sku, pim: screen.attributes, brand: 'Talasey' },
      category_ids: [CATEGORY],
    });
    expect(change.variants).toEqual([]);
  });

  it('finds a renamed product by its SKUs and keeps its handle', () => {
    const existing = asImported({ handle: 'abstract-branches-screen', title: 'Old name' });
    const plan = planImport([screen], [existing], categoryIdFor);
    expect(plan.create).toEqual([]);
    expect(plan.update[0]).toMatchObject({
      id: 'prod_screen',
      handle: 'abstract-branches-screen',
    });
  });

  it('updates a changed price and never clears a price the sheet leaves blank', () => {
    const existing = asImported();
    existing.variants = existing.variants.map((variant, index) =>
      index === 0
        ? { ...variant, priceIncVat: 70 }
        : index === 2
          ? { ...variant, priceIncVat: 150 }
          : variant,
    );
    const [change] = planImport([screen], [existing], categoryIdFor).update as [ProductChange];
    expect(change.fields).toBeNull();
    expect(change.variants).toEqual([
      {
        id: 'variant_0',
        sku: 'SCRAB1800-300C',
        title: '1800 × 300 mm / Weathered Steel',
        weight: null,
        priceIncVat: 79.99,
      },
    ]);
  });

  it('adds a new SKU whose option values the product already has', () => {
    const existing = asImported();
    existing.variants.pop();
    const [change] = planImport([screen], [existing], categoryIdFor).update as [ProductChange];
    expect(change.newVariants.map((variant) => variant.sku)).toEqual(['SCRAB1800-600PC']);
  });

  it('skips a new SKU that needs an option value the product does not have', () => {
    const existing = asImported({
      options: [
        { title: 'Size', values: ['1800 × 300 mm', '1800 × 600 mm'] },
        { title: 'Finish', values: ['Weathered Steel'] },
      ],
    });
    existing.variants.pop();
    const plan = planImport([screen], [existing], categoryIdFor);
    expect(plan.skipped).toEqual([
      { sku: 'SCRAB1800-600PC', handle: screen.handle, reason: NEW_OPTION_VALUE },
    ]);
    expect(plan.unchanged).toEqual([screen.handle]);
  });
});
