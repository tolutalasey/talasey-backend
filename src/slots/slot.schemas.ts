import { z } from 'zod';

export const slotQuerySchema = z.object({ postcode: z.string().min(1) });

export const createSlotHoldSchema = z.object({
  postcode: z.string().min(1),
  date: z.iso.date(),
  reference: z
    .string()
    .min(1)
    .max(200)
    .describe('Who holds it, usually the basket ID. A new hold releases the old one.'),
});

export const holdIdSchema = z.uuid();

export type SlotQuery = z.infer<typeof slotQuerySchema>;
export type CreateSlotHold = z.infer<typeof createSlotHoldSchema>;

export const slotAvailabilitySchema = z.object({
  postcode: z.string(),
  zone: z.string(),
  sample: z.boolean().describe('True while slots come from sample settings'),
  slots: z.array(
    z.object({
      date: z.iso.date(),
      remaining: z.number().int().describe('Pallet deliveries still free that day'),
    }),
  ),
});

export const slotHoldSchema = z.object({
  id: z.uuid(),
  zone: z.string(),
  date: z.iso.date(),
  reference: z.string(),
  status: z.enum(['held', 'booked', 'released']),
  expiresAt: z.iso.datetime(),
  active: z.boolean().describe('Booked, or held and not expired'),
});

export type SlotAvailabilityDto = z.infer<typeof slotAvailabilitySchema>;
export type SlotHoldDto = z.infer<typeof slotHoldSchema>;
