import { z } from 'zod';
import { shipmentSchema } from '../delivery.schemas.js';

export const zoneNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case words joined by hyphens, like north-west');

export const zoneConfigInputSchema = z
  .object({
    areas: z
      .array(
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{1,2}$/, 'Postcode areas are one or two letters, like M or SK'),
      )
      .min(1, 'Add at least one postcode area'),
    rates: z
      .array(
        z.object({
          shipment: shipmentSchema,
          maxWeightKg: z.number().int().positive(),
          pricePence: z.number().int().nonnegative(),
        }),
      )
      .min(1, 'Add at least one delivery rate'),
    palletsPerDay: z.number().int().positive().nullable(),
    leadTimeDays: z.number().int().min(0).max(30).nullable(),
  })
  .refine((zone) => (zone.palletsPerDay === null) === (zone.leadTimeDays === null), {
    message: 'Give both pallets per day and lead time, or neither',
    path: ['palletsPerDay'],
  });

export const zoneConfigSchema = z.object({
  zone: z.string(),
  areas: z.array(z.string()),
  rates: z.array(
    z.object({ shipment: shipmentSchema, maxWeightKg: z.number(), pricePence: z.number() }),
  ),
  palletsPerDay: z.number().nullable(),
  leadTimeDays: z.number().nullable(),
  sample: z.boolean(),
});

export const zoneDaySchema = z.object({
  date: z.iso.date(),
  capacity: z.number().int(),
  held: z.number().int(),
  booked: z.number().int(),
});

export type ZoneConfigInput = z.infer<typeof zoneConfigInputSchema>;
export type ZoneConfig = z.infer<typeof zoneConfigSchema>;
export type ZoneDay = z.infer<typeof zoneDaySchema>;

// Problems a single zone's settings can't show on their own: duplicate areas and rate bands.
export function zoneConfigProblems(
  zone: string,
  input: ZoneConfigInput,
  others: ZoneConfig[],
): string[] {
  const problems: string[] = [];
  const areas = new Set<string>();
  for (const area of input.areas) {
    if (areas.has(area)) problems.push(`${area} is listed twice`);
    areas.add(area);
    const owner = others.find((other) => other.zone !== zone && other.areas.includes(area));
    if (owner) problems.push(`${area} is already in ${owner.zone}`);
  }
  const bands = new Set<string>();
  for (const rate of input.rates) {
    const band = `${rate.shipment}:${rate.maxWeightKg}`;
    if (bands.has(band)) {
      problems.push(`There are two ${rate.shipment} rates up to ${rate.maxWeightKg} kg`);
    }
    bands.add(band);
  }
  if (input.palletsPerDay === null && input.rates.some((rate) => rate.shipment === 'pallet')) {
    problems.push('Pallet rates need pallets per day and a lead time');
  }
  return problems;
}
