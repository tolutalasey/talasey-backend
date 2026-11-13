import { z } from 'zod';
import { PAGE_TYPES } from './rules/page-types.js';
import { STOCK_MODES } from './rules/stock-mode.js';

const image = z.object({
  url: z.string(),
  alt: z.string(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});
const option = z.object({ title: z.string(), values: z.array(z.string()) });

export const storeVariantSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  options: z.record(z.string(), z.string()),
  pricePence: z.number().int().nullable().describe('Including VAT; null means not for sale yet'),
  stock: z.object({
    managed: z.boolean().describe('False means made to order: always available'),
    quantity: z.number().int().nullable(),
    backorder: z.boolean().describe('Made to order once the stock runs out'),
  }),
  coverageM2: z.number().nullable(),
  weightKg: z.number().nullable(),
});

export const storeProductSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  thumbnail: z.string().nullable(),
  images: z.array(image),
  pageType: z.enum(PAGE_TYPES).nullable(),
  madeToMeasure: z.boolean(),
  leadTime: z.object({ minDays: z.number(), maxDays: z.number() }).nullable(),
  updatedAt: z.iso.datetime(),
  categories: z.array(z.object({ handle: z.string(), name: z.string() })),
  options: z.array(option),
  colourChoice: z
    .object({
      label: z.string(),
      option: z.string().nullable(),
      value: z.string().nullable(),
      required: z.boolean(),
    })
    .nullable(),
  variants: z.array(storeVariantSchema),
});

export const colourOfferSchema = z
  .object({
    required: z.boolean(),
    colours: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        hex: z.string(),
        photoUrl: z.string().nullable(),
      }),
    ),
  })
  .nullable();

export type StoreProduct = z.infer<typeof storeProductSchema>;
export type ColourOfferDto = z.infer<typeof colourOfferSchema>;

const variantInput = z.object({
  id: z.uuid().optional().describe('Leave out for a new option'),
  sku: z.string().trim().min(1).nullable(),
  title: z.string().trim(),
  options: z.record(z.string(), z.string()).default({}),
  pricePence: z.number().int().nullable(),
  weightKg: z.number().positive().nullable(),
  coverageM2: z.number().positive().nullable(),
  stockQuantity: z.number().int().min(0).default(0),
  barcode: z.string().trim().min(1).nullable().default(null),
});

export const productInputSchema = z.object({
  handle: z.string().trim(),
  title: z.string().trim(),
  subtitle: z.string().trim().nullable(),
  description: z.string().nullable(),
  brand: z.string().trim().nullable(),
  published: z.boolean(),
  pageType: z.enum(PAGE_TYPES).nullable(),
  stockMode: z.enum(STOCK_MODES),
  leadTimeMinDays: z.number().int().nullable(),
  leadTimeMaxDays: z.number().int().nullable(),
  categoryId: z.uuid().nullable(),
  options: z.array(option),
  colourSetId: z.uuid().nullable(),
  colourOption: z.string().nullable(),
  colourOptionValue: z.string().nullable(),
  colourRequired: z.boolean(),
  colourLabel: z.string().nullable(),
  bespoke: z.unknown().nullable(),
  variants: z.array(variantInput),
  images: z.array(image),
  colourImages: z.array(image.extend({ colourId: z.uuid(), size: z.string(), finish: z.string() })),
});

export const newProductSchema = z.object({
  title: z.string().trim().min(1),
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const adminProductSchema = productInputSchema.extend({
  id: z.uuid(),
  attributes: z.record(z.string(), z.string()),
  pimSku: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  variants: z.array(variantInput.extend({ id: z.uuid() })),
  problems: z.array(z.string()).describe('SKU checks for this product'),
});

export const productSummarySchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  title: z.string(),
  published: z.boolean(),
  pageType: z.enum(PAGE_TYPES).nullable(),
  variantCount: z.number().int(),
  priceFromPence: z.number().int().nullable(),
  unpriced: z.number().int(),
  thumbnail: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export const bespokeTrialSchema = z.object({
  config: z.unknown().describe('The made-to-measure set-up being tried, saved or not'),
  dimensions: z.record(z.string(), z.number()),
  choices: z.record(z.string(), z.string()).describe('Choice short name → answer label'),
});

export const bespokeTrialResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), pricePence: z.number().int() }),
  z.object({ ok: z.literal(false), problems: z.array(z.string()) }),
]);

export const productSearchSchema = z.object({ search: z.string().optional() });

export const categorySchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  parentId: z.uuid().nullable(),
});

const colourInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim(),
  hex: z.string().trim(),
  photoUrl: z.string().nullable().default(null),
});

export const colourSetInputSchema = z.object({
  name: z.string().trim(),
  colours: z.array(colourInput),
});

export const colourSetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  usedBy: z.number().int(),
  colours: z.array(colourInput.extend({ id: z.uuid() })),
});

export const skuProblemSchema = z.object({
  productId: z.uuid(),
  productTitle: z.string(),
  variantId: z.string().optional(),
  rule: z.enum(['missing-sku', 'duplicate-sku', 'colour-option', 'colour-in-sku', 'code-in-name']),
  message: z.string(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type NewProduct = z.infer<typeof newProductSchema>;
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type ColourSetInput = z.infer<typeof colourSetInputSchema>;
