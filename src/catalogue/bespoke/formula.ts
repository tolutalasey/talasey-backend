type Token =
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'symbol'; value: string };

const SYMBOLS = ['>=', '<=', '>', '<', '+', '-', '*', '/', '(', ')', ',', '='];
const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
};

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const space = /^\s+/.exec(rest);
    const number = /^\d+(\.\d+)?/.exec(rest);
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    const symbol = SYMBOLS.find((candidate) => rest.startsWith(candidate));

    if (space) index += space[0].length;
    else if (number) {
      tokens.push({ kind: 'number', value: Number(number[0]) });
      index += number[0].length;
    } else if (name) {
      tokens.push({ kind: 'name', value: name[0] });
      index += name[0].length;
    } else if (symbol) {
      tokens.push({ kind: 'symbol', value: symbol });
      index += symbol.length;
    } else {
      throw new FormulaError(`Unexpected "${rest[0]}" in formula`);
    }
  }
  return tokens;
}

class Evaluator {
  private position = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly variables: Record<string, number>,
  ) {}

  run(): number {
    const value = this.comparison();
    if (this.position < this.tokens.length) throw new FormulaError('Unexpected text after a value');
    return value;
  }

  private peek(value: string): boolean {
    const token = this.tokens[this.position];
    return token?.kind === 'symbol' && token.value === value;
  }

  private expect(value: string) {
    if (!this.peek(value)) throw new FormulaError(`Expected "${value}"`);
    this.position += 1;
  }

  private comparison(): number {
    const left = this.additive();
    for (const operator of ['>=', '<=', '>', '<']) {
      if (this.peek(operator)) {
        this.position += 1;
        const right = this.additive();
        const result = {
          '>=': left >= right,
          '<=': left <= right,
          '>': left > right,
          '<': left < right,
        }[operator];
        return result ? 1 : 0;
      }
    }
    return left;
  }

  private additive(): number {
    let value = this.term();
    while (this.peek('+') || this.peek('-')) {
      const operator = this.tokens[this.position++]?.value;
      const right = this.term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    while (this.peek('*') || this.peek('/')) {
      const operator = this.tokens[this.position++]?.value;
      const right = this.unary();
      if (operator === '/' && right === 0) throw new FormulaError('Division by zero');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  private unary(): number {
    if (this.peek('-')) {
      this.position += 1;
      return -this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.tokens[this.position++];
    if (!token) throw new FormulaError('The formula ends too early');
    if (token.kind === 'number') return token.value;
    if (token.kind === 'symbol' && token.value === '(') {
      const value = this.comparison();
      this.expect(')');
      return value;
    }
    if (token.kind === 'name') {
      if (this.peek('(')) return this.call(token.value);
      const value = this.variables[token.value];
      if (value === undefined) throw new FormulaError(`Unknown name ${token.value}`);
      return value;
    }
    throw new FormulaError(`Unexpected "${token.value}"`);
  }

  private call(name: string): number {
    this.expect('(');
    const args = [this.comparison()];
    while (this.peek(',')) {
      this.position += 1;
      args.push(this.comparison());
    }
    this.expect(')');

    if (name === 'if') {
      if (args.length !== 3) throw new FormulaError('if() takes a condition and two values');
      return args[0] ? (args[1] as number) : (args[2] as number);
    }
    const fn = FUNCTIONS[name];
    if (!fn) throw new FormulaError(`Unknown function ${name}`);
    return fn(...args);
  }
}

// A formula is steps separated by semicolons. "NAME = value" defines a figure; the last step is the
// result. The language is the one in the product sheet's Formulas tab.
export function evaluateFormula(formula: string, inputs: Record<string, number>): number {
  const steps = formula
    .split(';')
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length === 0) throw new FormulaError('The formula is empty');

  const variables = { ...inputs };
  let result = Number.NaN;
  steps.forEach((step, index) => {
    const tokens = tokenize(step);
    const [first, second] = tokens;
    const isAssignment =
      first?.kind === 'name' && second?.kind === 'symbol' && second.value === '=';
    if (isAssignment && index === steps.length - 1) {
      throw new FormulaError('The last step must be the price, not a named figure');
    }
    const value = new Evaluator(isAssignment ? tokens.slice(2) : tokens, variables).run();
    if (isAssignment) variables[first.value] = value;
    else result = value;
  });

  if (!Number.isFinite(result)) throw new FormulaError('The formula did not produce a number');
  return result;
}
