import { describe, expect, it } from 'vitest';
import {
  describeSplit,
  splitLines,
  splitStock,
  STOCK_MODES,
  stockMode,
  stockSettings,
} from './stock-mode.js';

describe('stockMode', () => {
  it('reads the mode from the inventory settings', () => {
    expect(stockMode({ manage_inventory: true, allow_backorder: false })).toBe('stocked');
    expect(stockMode({ manage_inventory: false, allow_backorder: false })).toBe('made_to_order');
    expect(stockMode({ manage_inventory: false, allow_backorder: true })).toBe('made_to_order');
    expect(stockMode({ manage_inventory: true, allow_backorder: true })).toBe(
      'stocked_then_made_to_order',
    );
  });
});

describe('splitStock', () => {
  it('sells stocked items only while there is stock', () => {
    expect(splitStock('stocked', 3, 2)).toEqual({
      mode: 'stocked',
      now: 2,
      made_to_order: 0,
      purchasable: true,
    });
    expect(splitStock('stocked', 3, 5)).toEqual({
      mode: 'stocked',
      now: 3,
      made_to_order: 0,
      purchasable: false,
    });
  });

  it('always makes made-to-order items', () => {
    expect(splitStock('made_to_order', null, 4)).toEqual({
      mode: 'made_to_order',
      now: 0,
      made_to_order: 4,
      purchasable: true,
    });
  });

  it('sends what is in stock now and makes the rest', () => {
    expect(splitStock('stocked_then_made_to_order', 3, 5)).toEqual({
      mode: 'stocked_then_made_to_order',
      now: 3,
      made_to_order: 2,
      purchasable: true,
    });
    expect(splitStock('stocked_then_made_to_order', -2, 2)).toMatchObject({
      now: 0,
      made_to_order: 2,
    });
  });
});

describe('describeSplit', () => {
  it('says how many come from stock and how many are made', () => {
    expect(describeSplit(splitStock('stocked_then_made_to_order', 3, 5))).toBe(
      '3 now, 2 made to order',
    );
    expect(describeSplit(splitStock('stocked_then_made_to_order', 8, 5))).toBe('5 in stock');
    expect(describeSplit(splitStock('made_to_order', null, 2))).toBe('2 made to order');
  });
});

describe('splitLines', () => {
  it('shares one SKU’s stock across the lines that use it', () => {
    const line = { variant_id: 'slab', manage_inventory: true, allow_backorder: true };
    expect(
      splitLines(
        [
          { id: 'a', quantity: 4, ...line },
          { id: 'b', quantity: 3, ...line },
        ],
        { slab: 5 },
      ).map(({ line_id, label }) => [line_id, label]),
    ).toEqual([
      ['a', '4 in stock'],
      ['b', '1 now, 2 made to order'],
    ]);
  });
});

describe('stockSettings', () => {
  it.each(STOCK_MODES)('turns %s back into the stock settings that produce it', (mode) => {
    expect(stockMode(stockSettings(mode))).toBe(mode);
  });
});
