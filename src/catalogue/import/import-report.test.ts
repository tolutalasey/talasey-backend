import { describe, expect, it } from 'vitest';
import { importReport } from './import-report.js';
import type { ImportResult } from './catalogue-import.js';
import type { CatalogueSummary } from './pim-source.js';

const summary: CatalogueSummary = {
  rows: 7,
  products: 3,
  withVariants: 1,
  single: 2,
  skus: 5,
  heldBack: 2,
  unpriced: 2,
  heldBackReasons: { 'No SKU.': 2 },
};

const result: ImportResult = {
  dryRun: true,
  created: 1,
  updated: 1,
  unchanged: 1,
  categoriesCreated: 2,
  colourSetsCreated: 2,
  coloursAdded: 0,
  profilesCreated: 19,
  skipped: [{ sku: 'SCR-1', handle: 'screen', reason: 'New option value.' }],
};

describe('importReport', () => {
  it('reports counts, held-back reasons and what a dry run would change', () => {
    expect(importReport('Master sheet', summary, result)).toEqual([
      'Master sheet: 7 rows, 3 products (1 with options, 2 single), 5 SKUs, 2 held back, 2 without a price.',
      'Held back (2): No SKU.',
      'Would create 1 products and 2 categories, update 1; 1 unchanged.',
      'Would create 2 colour sets, add 0 colours and give 19 products a colour set (page type 1B).',
      'Skipped SCR-1 on screen: New option value.',
      'Dry run: nothing was changed.',
    ]);
  });

  it('reports what a real run did', () => {
    const lines = importReport('Master sheet', summary, { ...result, dryRun: false });
    expect(lines).toContain('Did create 1 products and 2 categories, update 1; 1 unchanged.');
    expect(lines.at(-1)).not.toMatch(/Dry run/);
  });
});
