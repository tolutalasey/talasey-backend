import { z } from 'zod';

const data = z.record(z.string(), z.unknown());

export const contentTypeSchema = z.object({
  type: z.string(),
  label: z.string(),
  singleton: z.boolean(),
  locked: z.boolean(),
  canPublish: z.boolean().describe('Whether the signed-in user can publish this type'),
  fields: z.array(data).describe('Field descriptions the editing form is drawn from'),
});

export const contentSummarySchema = z.object({
  id: z.uuid(),
  type: z.string(),
  key: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'published', 'changed']),
  updatedBy: z.string(),
  updatedAt: z.iso.datetime(),
});

export const contentDocumentSchema = contentSummarySchema.extend({
  draft: data,
  published: data.nullable(),
  publishedBy: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  problems: z.array(z.string()).describe('What to fix before it can be published'),
  canPublish: z.boolean(),
});

export const newContentSchema = z.object({ type: z.string(), data });
export const contentDraftSchema = z.object({ data });
export const contentListQuerySchema = z.object({ type: z.string() });

export type ContentDocumentDto = z.infer<typeof contentDocumentSchema>;
