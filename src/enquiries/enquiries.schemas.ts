import { z } from 'zod';

export const ENQUIRY_KINDS = ['contact', 'site-survey'] as const;
export const ENQUIRY_STATUSES = ['new', 'in-progress', 'done'] as const;
export const MAX_ENQUIRY_PHOTOS = 5;
export const MAX_ENQUIRY_PHOTO_BYTES = 5 * 1024 * 1024;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

// Sent as form fields alongside the photos, so everything arrives as text.
export const enquiryInputSchema = z.object({
  kind: z.enum(ENQUIRY_KINDS),
  name: z.string().trim().min(1, 'Enter your name').max(200),
  email: z.email('Enter an email address like name@example.com'),
  phone: optionalText(40),
  postcode: optionalText(12),
  productHandle: optionalText(200),
  topic: optionalText(100),
  message: optionalText(3000),
  answers: z
    .preprocess(
      (value) => (typeof value === 'string' && value ? JSON.parse(value) : (value ?? {})),
      z.record(z.string().max(100), z.string().max(500)),
    )
    .refine((answers) => Object.keys(answers).length <= 20, 'Too many answers'),
  consent: z.preprocess((value) => value === true || value === 'true', z.boolean()),
  // Left empty by people; filled by bots that fill every field.
  website: optionalText(200),
});

export type EnquiryInput = z.infer<typeof enquiryInputSchema>;

export const enquirySchema = z.object({
  id: z.uuid(),
  kind: z.enum(ENQUIRY_KINDS),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  postcode: z.string().nullable(),
  productHandle: z.string().nullable(),
  productTitle: z.string().nullable(),
  topic: z.string().nullable(),
  message: z.string().nullable(),
  answers: z.record(z.string(), z.string()),
  photoCount: z.number().int(),
  consent: z.boolean(),
  status: z.enum(ENQUIRY_STATUSES),
  createdAt: z.iso.datetime(),
});

export type EnquiryDto = z.infer<typeof enquirySchema>;

export const enquiryStatusSchema = z.object({ status: z.enum(ENQUIRY_STATUSES) });
