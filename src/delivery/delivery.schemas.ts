import { z } from 'zod';

export const MAX_WEIGHT_KG = 30_000;

export const shipmentSchema = z.enum(['parcel', 'pallet']);

export const deliveryQuoteQuerySchema = z.object({
  postcode: z.string().min(1).meta({ example: 'M1 1AE' }),
  shipment: shipmentSchema,
  weightKg: z.coerce.number().positive().max(MAX_WEIGHT_KG),
});

export type DeliveryQuoteQuery = z.infer<typeof deliveryQuoteQuerySchema>;

export const deliveryZoneSchema = z.object({
  postcode: z.string().describe('The postcode, normalised'),
  area: z.string().describe('Postcode area (leading letters)'),
  zone: z.string(),
  sample: z.boolean().describe('True while the zone comes from sample data'),
});

export const deliveryQuoteSchema = z.object({
  postcode: z.string(),
  zone: z.string(),
  shipment: shipmentSchema,
  weightKg: z.number(),
  pricePence: z.number().int().describe('Price including VAT, in pence'),
  requiresSlot: z.boolean().describe('Pallet deliveries need a booked day'),
  sample: z.boolean().describe('True while the price comes from sample rates'),
});
