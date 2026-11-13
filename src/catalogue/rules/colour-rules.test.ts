import { describe, expect, it } from 'vitest';
import { colourProblem, coloursFor, type ColourRule } from './colour-rules.js';

const rule: ColourRule = {
  option: 'Finish',
  value: 'Powder coated',
  required: true,
  colours: [{ id: 'col_1', name: 'Anthracite grey', hex: '#383E42', photo_url: null }],
};

describe('coloursFor', () => {
  it('offers the colours only when the rule’s option has its value', () => {
    expect(coloursFor(rule, { Finish: 'Powder coated', Size: '1800 × 300 mm' })).toEqual({
      required: true,
      colours: rule.colours,
    });
    expect(coloursFor(rule, { Finish: 'Weathered steel' })).toBeNull();
    expect(coloursFor(rule, {})).toBeNull();
  });

  it('applies to every variant when the rule has no option', () => {
    expect(coloursFor({ ...rule, option: null, value: null }, {})?.colours).toHaveLength(1);
  });

  it('offers nothing without a set or colours', () => {
    expect(coloursFor(null, { Finish: 'Powder coated' })).toBeNull();
    expect(coloursFor({ ...rule, colours: [] }, { Finish: 'Powder coated' })).toBeNull();
  });
});

describe('colourProblem', () => {
  const powder = { Finish: 'Powder coated' };

  it('asks for a colour when the set is required', () => {
    expect(colourProblem(rule, powder, {}, 'powder coat colour')).toBe(
      'Choose a powder coat colour.',
    );
  });

  it('accepts a colour from the set', () => {
    expect(colourProblem(rule, powder, { colour_id: 'col_1' })).toBeNull();
  });

  it('refuses a colour from somewhere else, or a name that is not the colour’s', () => {
    expect(colourProblem(rule, powder, { colour_id: 'col_9' })).toMatch(/from the list/);
    expect(colourProblem(rule, powder, { colour_id: 'col_1', colour: 'Gold' })).toMatch(
      /from the list/,
    );
    expect(
      colourProblem(rule, powder, { colour_id: 'col_1', colour: 'Anthracite grey' }),
    ).toBeNull();
  });

  it('refuses a colour on options that take none, and needs none there', () => {
    expect(colourProblem(rule, { Finish: 'Weathered steel' }, { colour_id: 'col_1' })).toMatch(
      /doesn't come in a choice/,
    );
    expect(colourProblem(rule, { Finish: 'Weathered steel' }, undefined)).toBeNull();
  });
});
