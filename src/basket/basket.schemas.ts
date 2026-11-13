import { z } from 'zod';
import { parsePostcode } from '../delivery/postcode.js';

const postcode = z
  .string()
  .trim()
  .refine((value) => parsePostcode(value) !== null, 'Enter a full UK postcode, for example M1 1AE');

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name'),
  lastName: z.string().trim().min(1, 'Enter your last name'),
  address1: z.string().trim().min(1, 'Enter the first line of the address'),
  city: z.string().trim().min(1, 'Enter the town or city'),
  postcode,
  phone: z.string().trim().min(10, 'Enter a phone number the driver can call'),
});

export const accessAnswersSchema = z.object({
  vehicleAccess: z.enum(['articulated', 'rigid', 'small']),
  hardStanding: z.boolean(),
  kerbsideOk: z.boolean(),
});

export const shipmentSchema = z.enum(['pallet', 'parcel']);

export const addLineSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().positive().max(999),
  colourId: z.uuid().optional(),
});

export const bespokeItemSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().positive().max(99).default(1),
  dimensions: z.record(z.string(), z.number()),
  choices: z.record(z.string(), z.string()).default({}),
  unitPricePence: z
    .number()
    .optional()
    .describe('The price the shopper saw. Accepted so a form can send it, never used.'),
});

export const bespokeQuoteSchema = bespokeItemSchema.pick({ dimensions: true, choices: true });

export const buildSchema = z.object({
  parts: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().positive(),
        side: z.string().optional(),
      }),
    )
    .min(1),
});

export const quantitySchema = z.object({ quantity: z.number().int().min(0).max(999) });
export const contactSchema = z.object({
  email: z.email('Enter an email like name@example.com'),
  address: addressSchema,
});
export const deliveryChoiceSchema = z.object({ shipment: shipmentSchema });
export const deliveryDaySchema = z.object({ date: z.iso.date('Use a date like 2026-11-17') });
export const completeSchema = z.object({ paymentReference: z.string().optional() });

const lineSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  handle: z.string(),
  title: z.string(),
  variantId: z.uuid(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  colour: z.string().nullable(),
  quantity: z.number().int(),
  unitPricePence: z.number().int().nullable(),
  totalPence: z.number().int(),
  buildId: z.string().nullable(),
  bespoke: z
    .object({
      unit: z.string(),
      dimensions: z.record(z.string(), z.number()),
      choices: z.record(z.string(), z.string()),
    })
    .nullable(),
  stock: z.string().describe('For example "3 now, 2 made to order"'),
});

const deliverySchema = z.object({
  shipment: shipmentSchema.nullable(),
  name: z.string().nullable(),
  day: z
    .object({ date: z.iso.date(), status: z.enum(['held', 'booked', 'needs-rebooking']) })
    .nullable(),
  access: accessAnswersSchema.nullable(),
});

export const basketSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  address: addressSchema.nullable(),
  lines: z.array(lineSchema),
  itemTotalPence: z.number().int(),
  deliveryPence: z.number().int().nullable(),
  deliveryProblem: z.string().nullable(),
  totalPence: z.number().int(),
  delivery: deliverySchema,
  orderId: z.uuid().nullable(),
  payment: z.enum(['stripe', 'test']),
});

export const deliveryOptionSchema = z.object({
  shipment: shipmentSchema,
  name: z.string(),
  pricePence: z.number().int().nullable(),
  problem: z.string().nullable(),
});

export const deliveryDayOptionSchema = z.object({
  date: z.iso.date(),
  remaining: z.number().int(),
});

export const paymentStartSchema = z.object({
  provider: z.enum(['stripe', 'test']),
  clientSecret: z.string().nullable(),
  amountPence: z.number().int(),
});

export const placedSchema = z.object({ orderId: z.uuid() });

export const orderSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  email: z.string(),
  address: addressSchema,
  lines: z.array(
    lineSchema
      .omit({ productId: true, handle: true, variantId: true })
      .extend({ variantId: z.uuid().nullable() }),
  ),
  itemTotalPence: z.number().int(),
  deliveryPence: z.number().int(),
  totalPence: z.number().int(),
  delivery: deliverySchema,
  payment: z.object({
    provider: z.enum(['stripe', 'test']),
    status: z.enum(['paid', 'partly_refunded', 'refunded']),
    refundedPence: z.number().int(),
  }),
  status: z.enum(['placed', 'cancelled']),
  createdAt: z.iso.datetime(),
});

export type BasketDto = z.infer<typeof basketSchema>;
export type OrderDto = z.infer<typeof orderSchema>;
