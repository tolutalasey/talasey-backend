import { z } from 'zod';
import { evaluateFormula, FormulaError } from './formula.js';

const dimensionSchema = z.object({
  label: z.string(),
  min: z.number().positive(),
  max: z.number().positive(),
  step: z.number().positive(),
});

export const bespokeConfigSchema = z.object({
  unit: z.enum(['mm', 'cm']),
  formula: z.string().min(1),
  rounding: z.enum(['none', 'nearest_1', 'up_1', 'up_5', 'up_10']).default('none'),
  min_price: z.number().nonnegative().optional(),
  dimensions: z.partialRecord(z.enum(['W', 'H', 'D', 'L']), dimensionSchema),
  choices: z
    .array(
      z.object({
        label: z.string(),
        name: z.string().regex(/^[A-Z_]+$/),
        answers: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
      }),
    )
    .default([]),
});

export type BespokeConfig = z.infer<typeof bespokeConfigSchema>;

export interface BespokeSelection {
  dimensions: Record<string, number>;
  choices: Record<string, string>;
}

export type BespokePriceResult = { ok: true; price: number } | { ok: false; problems: string[] };

const round2 = (value: number) => Math.round(value * 100) / 100;

function applyRounding(value: number, rounding: BespokeConfig['rounding']): number {
  switch (rounding) {
    case 'none':
      return round2(value);
    case 'nearest_1':
      return Math.round(value);
    case 'up_1':
      return Math.ceil(value);
    case 'up_5':
      return Math.ceil(value / 5) * 5;
    case 'up_10':
      return Math.ceil(value / 10) * 10;
  }
}

function dimensionProblems(config: BespokeConfig, given: Record<string, number>): string[] {
  const problems: string[] = [];
  for (const [name, limits] of Object.entries(config.dimensions)) {
    const value = given[name];
    if (value === undefined || !Number.isFinite(value)) {
      problems.push(`Enter the ${limits.label.toLowerCase()}.`);
    } else if (value < limits.min || value > limits.max) {
      problems.push(
        `${limits.label} must be between ${limits.min} and ${limits.max} ${config.unit}.`,
      );
    } else if (Math.abs(((value - limits.min) / limits.step) % 1) > 1e-9) {
      problems.push(`${limits.label} must be in steps of ${limits.step} ${config.unit}.`);
    }
  }
  for (const name of Object.keys(given)) {
    if (!(name in config.dimensions)) problems.push(`This product has no ${name} measurement.`);
  }
  return problems;
}

export function priceBespoke(
  config: BespokeConfig,
  selection: BespokeSelection,
): BespokePriceResult {
  const problems = dimensionProblems(config, selection.dimensions);
  const inputs: Record<string, number> = { ...selection.dimensions };

  for (const choice of config.choices) {
    const answer = choice.answers.find((option) => option.label === selection.choices[choice.name]);
    if (!answer) problems.push(`Choose an option for ${choice.label.toLowerCase()}.`);
    else inputs[choice.name] = answer.value;
  }
  if (problems.length > 0) return { ok: false, problems };

  try {
    const price = applyRounding(evaluateFormula(config.formula, inputs), config.rounding);
    return { ok: true, price: Math.max(price, config.min_price ?? 0) };
  } catch (error) {
    if (error instanceof FormulaError) return { ok: false, problems: [error.message] };
    throw error;
  }
}

export function readBespokeConfig(metadata?: Record<string, unknown> | null): BespokeConfig | null {
  const parsed = bespokeConfigSchema.safeParse(metadata?.bespoke);
  return parsed.success ? parsed.data : null;
}
