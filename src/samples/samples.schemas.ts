import { z } from 'zod';
import { addressSchema } from '../basket/basket.schemas.js';

export const MAX_SAMPLES = 5;

export const sampleOfferSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  active: z.boolean(),
  productId: z.uuid(),
  productTitle: z.string(),
  productHandle: z.string(),
  image: z.object({ url: z.string(), alt: z.string() }).nullable(),
});

export const newSampleOfferSchema = z.object({
  productHandle: z.string().trim().min(1, "Enter the product's web address"),
  label: z.string().trim().min(1, 'Name the sample, like the colour or finish'),
});

export const sampleOfferChangesSchema = z
  .object({ label: z.string().trim().min(1), active: z.boolean() })
  .partial();

// Phone is optional for samples: they come by post, not on a lorry.
export const sampleRequestInputSchema = z.object({
  email: z.email('Enter an email address like name@example.com'),
  address: addressSchema.extend({ phone: z.string().trim().default('') }),
  offerIds: z
    .array(z.uuid())
    .min(1, 'Choose at least one sample')
    .max(MAX_SAMPLES, `Choose up to ${MAX_SAMPLES} samples`)
    .refine((ids) => new Set(ids).size === ids.length, 'Each sample once, please'),
  marketingConsent: z.boolean().default(false),
});

export const sampleRequestSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  email: z.string(),
  address: addressSchema.extend({ phone: z.string() }),
  items: z.array(
    z.object({
      offerId: z.string(),
      productTitle: z.string(),
      productHandle: z.string(),
      label: z.string(),
    }),
  ),
  marketingConsent: z.boolean(),
  status: z.enum(['new', 'dispatched']),
  createdAt: z.iso.datetime(),
  dispatchedAt: z.iso.datetime().nullable(),
  dispatchedBy: z.string().nullable(),
});

export const sampleRequestPlacedSchema = z.object({ number: z.number().int() });
export const sampleRequestQuerySchema = z.object({
  status: z.enum(['new', 'dispatched']).optional(),
});

export type SampleOffer = z.infer<typeof sampleOfferSchema>;
export type SampleRequestInput = z.infer<typeof sampleRequestInputSchema>;
export type SampleRequestDto = z.infer<typeof sampleRequestSchema>;
