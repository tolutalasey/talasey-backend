import { describe, expect, it } from 'vitest';
import { isValidPostcode, parsePostcode } from './postcode.js';

describe('parsePostcode', () => {
  it.each([
    ['M1 1AE', { outward: 'M1', inward: '1AE', area: 'M', formatted: 'M1 1AE' }],
    ['m11ae', { outward: 'M1', inward: '1AE', area: 'M', formatted: 'M1 1AE' }],
    ['  sk4  1aa ', { outward: 'SK4', inward: '1AA', area: 'SK', formatted: 'SK4 1AA' }],
    ['OL16 2AB', { outward: 'OL16', inward: '2AB', area: 'OL', formatted: 'OL16 2AB' }],
    ['EC1A 1BB', { outward: 'EC1A', inward: '1BB', area: 'EC', formatted: 'EC1A 1BB' }],
    ['W1A 0AX', { outward: 'W1A', inward: '0AX', area: 'W', formatted: 'W1A 0AX' }],
    ['DN15 8QQ', { outward: 'DN15', inward: '8QQ', area: 'DN', formatted: 'DN15 8QQ' }],
  ])('normalises %j', (input, expected) => {
    expect(parsePostcode(input)).toEqual(expected);
  });

  it.each(['', 'M1', '1AE', 'MANCHESTER', 'M1 1A', 'ABC1 1AA', 'M1 AAE', 'M1-1AE'])(
    'rejects %j',
    (input) => {
      expect(parsePostcode(input)).toBeNull();
    },
  );
});

describe('isValidPostcode', () => {
  it('mirrors parsePostcode', () => {
    expect(isValidPostcode('SE2 0NX')).toBe(true);
    expect(isValidPostcode('not a postcode')).toBe(false);
  });
});
