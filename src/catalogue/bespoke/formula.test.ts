import { describe, expect, it } from 'vitest';
import { evaluateFormula, FormulaError } from './formula.js';

describe('evaluateFormula', () => {
  it('follows operator precedence and brackets', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('-2 * -3', {})).toBe(6);
  });

  it('uses named steps and inputs', () => {
    expect(evaluateFormula('AREA = W * H / 1000000; AREA * 10', { W: 2000, H: 500 })).toBe(10);
  });

  it('supports if() with comparisons', () => {
    const formula = 'RATE = if(FIN>2.5, 1100, if(FIN>1.5, 2320, 1100)); RATE';
    expect(evaluateFormula(formula, { FIN: 1 })).toBe(1100);
    expect(evaluateFormula(formula, { FIN: 2 })).toBe(2320);
    expect(evaluateFormula(formula, { FIN: 3 })).toBe(1100);
    expect(evaluateFormula('if(W >= 10, 1, 0) + if(W < 5, 10, 0)', { W: 10 })).toBe(1);
  });

  it('supports min and max', () => {
    expect(evaluateFormula('max(10, min(W, 50))', { W: 70 })).toBe(50);
  });

  it.each([
    ['', 'empty'],
    ['W +', 'ends too early'],
    ['X * 2', 'Unknown name X'],
    ['W / 0', 'Division by zero'],
    ['PRICE = W', 'last step'],
    ['W $ 2', 'Unexpected'],
    ['nope(W)', 'Unknown function'],
  ])('rejects %j', (formula, message) => {
    expect(() => evaluateFormula(formula, { W: 1 })).toThrow(FormulaError);
    expect(() => evaluateFormula(formula, { W: 1 })).toThrow(message);
  });
});
