import { z } from 'zod';

export const MAX_TURNS = 30;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
// Only the latest few photos in a conversation are looked at again with each message.
export const MAX_PHOTOS_SENT = 3;

const turnSchema = z.object({
  role: z.enum(['visitor', 'assistant']),
  text: z
    .string()
    .trim()
    .min(1)
    .max(MAX_MESSAGE_CHARS * 4),
  // A photo the visitor sent with this message, uploaded first through /store/assistant/photos.
  photoId: z.uuid().optional(),
});

export const assistantRequestSchema = z.object({
  // Made by the chat when a conversation starts, so staff can read it back as one.
  conversationId: z.uuid().optional(),
  // The whole conversation so far, oldest first, ending with the visitor's new message.
  turns: z
    .array(turnSchema)
    .min(1)
    .max(MAX_TURNS)
    .refine((turns) => turns.at(-1)?.role === 'visitor', 'The last message must be the visitor’s')
    .refine(
      (turns) => (turns.at(-1)?.text.length ?? 0) <= MAX_MESSAGE_CHARS,
      `Keep a message under ${MAX_MESSAGE_CHARS} characters`,
    ),
  // The page the visitor is on, e.g. /products/sofia-lune-porcelain-paving/
  page: z.string().max(300).optional(),
  pageTitle: z.string().max(300).optional(),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type Turn = z.infer<typeof turnSchema>;

export const productCardSchema = z.object({
  handle: z.string(),
  title: z.string(),
  href: z.string(),
  image: z.string().nullable(),
  // The variant picked for the visitor, such as "Pearl 600x600mm", when there are several.
  choice: z.string().nullable(),
  price: z.string().nullable(),
  stock: z.string(),
  add: z
    .object({ variantId: z.uuid(), quantity: z.number().int().positive(), label: z.string() })
    .nullable()
    .describe('Set when one variant is chosen and it can go straight in the bag'),
});
export type ProductCard = z.infer<typeof productCardSchema>;

export const assistantReplySchema = z.object({
  reply: z.string(),
  products: z.array(productCardSchema),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;

export const assistantStatusSchema = z.object({ enabled: z.boolean() });

export const assistantPhotoSchema = z.object({ photoId: z.uuid() });

export const assistantSwitchSchema = z.object({ on: z.boolean() });

export const assistantUsageSchema = z.object({
  days: z.number().int(),
  conversations: z.number().int(),
  messages: z.number().int(),
  gaps: z.number().int(),
  handedOff: z.number().int(),
  failed: z.number().int(),
  inputTokens: z.number().int(),
  cachedTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number().nullable().describe('Null when the model price is not set'),
});

export const assistantStatusAdminSchema = z.object({
  configured: z.boolean().describe('Whether ANTHROPIC_API_KEY is set'),
  on: z.boolean(),
  model: z.string(),
});

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  lastAt: z.iso.datetime(),
  messages: z.number().int(),
  firstQuestion: z.string(),
  pages: z.array(z.string()),
  photos: z.number().int(),
  gaps: z.number().int(),
  handedOff: z.boolean(),
});

export const exchangeSchema = z.object({
  id: z.uuid(),
  page: z.string().nullable(),
  question: z.string(),
  hadPhoto: z.boolean(),
  reply: z.string().nullable(),
  products: z.array(z.string()),
  gap: z.string().nullable(),
  handedOff: z.boolean(),
  failed: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const gapSchema = exchangeSchema
  .pick({ id: true, page: true, question: true, gap: true, createdAt: true })
  .extend({
    conversationId: z.uuid(),
  });
