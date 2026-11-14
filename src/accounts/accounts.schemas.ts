import { z } from 'zod';
import { orderSchema } from '../basket/basket.schemas.js';

export const signInLinkSchema = z.object({
  email: z.email('Enter an email address like name@example.com'),
});

export const redeemSchema = z.object({
  token: z.string().min(20).max(200),
});

export const customerSessionSchema = z.object({
  sessionToken: z.string(),
  email: z.string(),
});

export const sampleRequestSummarySchema = z.object({
  number: z.number().int(),
  status: z.enum(['new', 'dispatched']),
  createdAt: z.iso.datetime(),
  items: z.array(
    z.object({ productTitle: z.string(), productHandle: z.string(), label: z.string() }),
  ),
});

export const accountSchema = z.object({
  email: z.string(),
  orders: z.array(orderSchema),
  samples: z.array(sampleRequestSummarySchema),
});

export type AccountDto = z.infer<typeof accountSchema>;
