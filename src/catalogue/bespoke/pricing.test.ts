import { describe, expect, it } from 'vitest';
import {
  bespokeConfigSchema,
  checkBespokeConfig,
  priceBespoke,
  readBespokeConfig,
} from './pricing.js';
import { linea, sienna } from './planters.js';

describe('priceBespoke', () => {
  it('matches the Sienna prices checked against Audra’s sheet', () => {
    const base = { dimensions: { W: 1600, D: 1600, H: 900 } };
    expect(
      priceBespoke(sienna, {
        ...base,
        choices: { FIN: 'Mild steel', FEET: 'No', CASTORS: 'No', DRAIN: 'No' },
      }),
    ).toEqual({ ok: true, price: 1022.43 });
    expect(
      priceBespoke(sienna, {
        ...base,
        choices: { FIN: 'Mild steel', FEET: 'Yes', CASTORS: 'No', DRAIN: 'No' },
      }),
    ).toEqual({ ok: true, price: 1068.59 });
  });

  it('matches the Linea price checked against Audra’s sheet', () => {
    expect(
      priceBespoke(linea, {
        dimensions: { W: 1000, D: 1000, H: 500, L: 1000 },
        choices: { FIN: 'Mild steel', FEET: 'No', CASTORS: 'No', DRAIN: 'No' },
      }),
    ).toEqual({ ok: true, price: 951.71 });
  });

  it('lists every problem with the measurements and choices', () => {
    const result = priceBespoke(sienna, {
      dimensions: { W: 100, D: 1600.5, X: 3 },
      choices: { FIN: 'Gold' },
    });
    expect(result).toEqual({
      ok: false,
      problems: [
        'Width must be between 400 and 2400 mm.',
        'Enter the height.',
        'Depth must be in steps of 1 mm.',
        'This product has no X measurement.',
        'Choose an option for finish.',
        'Choose an option for feet.',
        'Choose an option for castors.',
        'Choose an option for drainage.',
      ],
    });
  });

  it('applies rounding and the minimum price', () => {
    const config = bespokeConfigSchema.parse({
      unit: 'mm',
      formula: 'W / 7',
      rounding: 'up_5',
      min_price: 50,
      dimensions: { W: { label: 'Width', min: 1, max: 5000, step: 1 } },
    });
    expect(priceBespoke(config, { dimensions: { W: 700 }, choices: {} })).toEqual({
      ok: true,
      price: 100,
    });
    expect(priceBespoke(config, { dimensions: { W: 71 }, choices: {} })).toEqual({
      ok: true,
      price: 50,
    });
  });
});

describe('readBespokeConfig', () => {
  it('reads a valid config from product metadata and ignores anything else', () => {
    expect(readBespokeConfig({ bespoke: sienna })).toMatchObject({ unit: 'mm' });
    expect(readBespokeConfig({ bespoke: { unit: 'inches' } })).toBeNull();
    expect(readBespokeConfig(null)).toBeNull();
  });
});

describe('checkBespokeConfig', () => {
  const simple = {
    unit: 'mm',
    formula: 'W * 0.1 + COAT',
    dimensions: { W: { label: 'Width', min: 400, max: 2400, step: 1 } },
    choices: [
      {
        label: 'Coating',
        name: 'COAT',
        answers: [
          { label: 'None', value: 0 },
          { label: 'Powder coated', value: 40 },
        ],
      },
    ],
  };

  it('accepts the planter set-ups and a simple one', () => {
    expect(checkBespokeConfig(sienna).ok).toBe(true);
    expect(checkBespokeConfig(linea).ok).toBe(true);
    expect(checkBespokeConfig(simple).ok).toBe(true);
  });

  it('explains a formula that uses a name it does not know, or does not parse', () => {
    expect(checkBespokeConfig({ ...simple, formula: 'W * RATE' })).toEqual({
      ok: false,
      problems: [expect.stringContaining('RATE')],
    });
    expect(checkBespokeConfig({ ...simple, formula: 'W * (2' }).ok).toBe(false);
  });

  it('explains sizes that do not make sense', () => {
    const backwards = {
      ...simple,
      dimensions: { W: { label: 'Width', min: 2400, max: 400, step: 1 } },
    };
    expect(checkBespokeConfig(backwards)).toEqual({
      ok: false,
      problems: ['Width (W): the smallest is bigger than the largest'],
    });
    expect(checkBespokeConfig({ ...simple, dimensions: {} }).ok).toBe(false);
  });

  it('refuses a formula that prices the smallest size at nothing', () => {
    expect(checkBespokeConfig({ ...simple, formula: 'COAT' }).ok).toBe(false);
  });
});
