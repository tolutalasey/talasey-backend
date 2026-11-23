import { z } from 'zod';

export const MAX_TURNS = 30;
export const MAX_MESSAGE_CHARS = 2000;

const turnSchema = z.object({
  role: z.enum(['visitor', 'assistant']),
  text: z
    .string()
    .trim()
    .min(1)
    .max(MAX_MESSAGE_CHARS * 4),
});

export const assistantRequestSchema = z.object({
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

export const assistantReplySchema = z.object({ reply: z.string() });
export type AssistantReply = z.infer<typeof assistantReplySchema>;

export const assistantStatusSchema = z.object({ enabled: z.boolean() });
