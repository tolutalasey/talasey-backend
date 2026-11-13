import { z } from 'zod';

export const auditEntrySchema = z.object({
  id: z.uuid(),
  subject: z.string(),
  subjectId: z.string(),
  label: z.string(),
  action: z.enum(['create', 'update', 'delete', 'restore']),
  before: z.unknown(),
  after: z.unknown(),
  actorName: z.string(),
  createdAt: z.iso.datetime(),
});

export const auditQuerySchema = z.object({
  subject: z.string().optional(),
  subjectId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
