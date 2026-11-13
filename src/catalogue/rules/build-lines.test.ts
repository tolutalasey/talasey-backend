import { describe, expect, it } from 'vitest';
import { buildLines } from './build-lines.js';

describe('buildLines', () => {
  it('combines parts with the same SKU and keeps where each one goes', () => {
    expect(
      buildLines('bld_1', [
        { variant_id: 'base', quantity: 1 },
        { variant_id: 'panel', quantity: 3, side: 'left' },
        { variant_id: 'panel', quantity: 3, side: 'right' },
      ]),
    ).toEqual([
      {
        variant_id: 'base',
        quantity: 1,
        metadata: { build_id: 'bld_1', build_parts: [{ quantity: 1 }] },
      },
      {
        variant_id: 'panel',
        quantity: 6,
        metadata: {
          build_id: 'bld_1',
          build_parts: [
            { quantity: 3, side: 'left' },
            { quantity: 3, side: 'right' },
          ],
        },
      },
    ]);
  });

  it('returns nothing for an empty build', () => {
    expect(buildLines('bld_1', [])).toEqual([]);
  });
});
