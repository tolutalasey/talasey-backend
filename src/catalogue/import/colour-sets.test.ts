import { describe, expect, it } from 'vitest';
import { colourSetName, planColourSets, planProfiles } from './colour-sets.js';
import { colourSetsFrom } from './master-sheet.js';
import type { PimProduct } from './pim-source.js';

const sheetRows = [
  ['Formulas'],
  ['Colour sets'],
  [''],
  ['standard_powder_coat_colours,"Anthracite grey (RAL 7016), Jet black (RAL 9005), Sky'],
  ['jointing_compound_colours', 'Buff, Grey, Basalt'],
  ['Adding a colour,"Colours are kept once"'],
];

describe('colourSetsFrom', () => {
  it('reads each set from the Formulas & colours tab, in either layout', () => {
    expect(colourSetsFrom(sheetRows)).toEqual([
      {
        key: 'standard_powder_coat_colours',
        colours: [
          { name: 'Anthracite grey', code: 'RAL 7016' },
          { name: 'Jet black', code: 'RAL 9005' },
          { name: 'Sky', code: null },
        ],
      },
      {
        key: 'jointing_compound_colours',
        colours: [
          { name: 'Buff', code: null },
          { name: 'Grey', code: null },
          { name: 'Basalt', code: null },
        ],
      },
    ]);
  });

  it('finds nothing without the block', () => {
    expect(colourSetsFrom([['Formulas']])).toEqual([]);
  });
});

describe('planColourSets', () => {
  const sheet = colourSetsFrom(sheetRows);

  it('creates missing sets with swatch shades for known RAL codes', () => {
    const plan = planColourSets(sheet, []);
    expect(plan.create[0]).toEqual({
      key: 'standard_powder_coat_colours',
      name: 'Standard powder coat colours',
      colours: [
        { name: 'Anthracite grey (RAL 7016)', hex: '#383E42', rank: 0 },
        { name: 'Jet black (RAL 9005)', hex: '#0A0A0A', rank: 1 },
        { name: 'Sky', hex: '#9E9E9E', rank: 2 },
      ],
    });
  });

  it('only adds the colours an existing set is missing', () => {
    const plan = planColourSets(sheet, [
      {
        id: 'colset_1',
        name: 'Standard powder coat colours',
        colours: [{ name: 'Anthracite grey (RAL 7016)' }, { name: 'Jet black (RAL 9005)' }],
      },
      {
        id: 'colset_2',
        name: 'Jointing compound colours',
        colours: [{ name: 'Buff' }, { name: 'Grey' }, { name: 'Basalt' }],
      },
    ]);
    expect(plan.create).toEqual([]);
    expect(plan.addColours).toEqual([
      {
        key: 'standard_powder_coat_colours',
        setId: 'colset_1',
        colours: [{ name: 'Sky', hex: '#9E9E9E', rank: 2 }],
      },
    ]);
  });

  it('names sets in plain words', () => {
    expect(colourSetName('jointing_compound_colours')).toBe('Jointing compound colours');
  });
});

describe('planProfiles', () => {
  const screen = {
    handle: 'abstract-branches-decorative-screen',
    attributes: {
      colour_set: 'standard_powder_coat_colours',
      colour_when: 'Finish',
      colour_values: 'Powder Coated',
      colour_required: 'yes',
    },
  } as unknown as PimProduct;
  const plain = { handle: 'fire-pit-liner', attributes: {} } as unknown as PimProduct;

  it('makes products with a colour set page type 1B, colour shown for the right finish', () => {
    expect(
      planProfiles(
        [screen, plain],
        new Map([
          [screen.handle, 'prod_1'],
          [plain.handle, 'prod_2'],
        ]),
        new Map([['standard_powder_coat_colours', 'colset_1']]),
        new Set(),
      ),
    ).toEqual([
      {
        product_id: 'prod_1',
        page_type: '1B',
        colour_set_id: 'colset_1',
        colour_option: 'Finish',
        colour_option_value: 'Powder Coated',
        colour_required: true,
      },
    ]);
  });

  it('leaves products that already have a profile alone', () => {
    expect(
      planProfiles(
        [screen],
        new Map([[screen.handle, 'prod_1']]),
        new Map([['standard_powder_coat_colours', 'colset_1']]),
        new Set(['prod_1']),
      ),
    ).toEqual([]);
  });
});
