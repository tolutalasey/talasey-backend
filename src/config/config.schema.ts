import { z } from 'zod';

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: optional(z.url({ protocol: /^rediss?$/ })),
  WEB_URL: z.url().default('http://localhost:3000'),
  SESSION_DAYS: z.coerce.number().int().positive().max(90).default(7),
  SLOT_HOLD_MINUTES: z.coerce.number().int().positive().default(15),
  SLOT_DAYS_AHEAD: z.coerce.number().int().positive().max(60).default(10),
  STRIPE_SECRET_KEY: optional(z.string().startsWith('sk_')),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_')),
  UPLOAD_DIR: z.string().default('.data/uploads'),
  // Cloudflare R2 for uploaded photos. Leave all four empty to keep them in UPLOAD_DIR.
  R2_ACCOUNT_ID: optional(z.string().regex(/^[a-f0-9]{32}$/, 'The 32-character account ID')),
  R2_BUCKET: optional(z.string().min(3)),
  R2_ACCESS_KEY_ID: optional(z.string().min(16)),
  R2_SECRET_ACCESS_KEY: optional(z.string().min(32)),
  REVALIDATE_SECRET: optional(z.string().min(32)),
});

export type AppConfig = z.infer<typeof configSchema>;

export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  const r2 = [
    result.data.R2_ACCOUNT_ID,
    result.data.R2_BUCKET,
    result.data.R2_ACCESS_KEY_ID,
    result.data.R2_SECRET_ACCESS_KEY,
  ];
  if (r2.some(Boolean) && !r2.every(Boolean)) {
    throw new Error(
      'Invalid environment variables:\n✖ Set all four R2_ variables, or none to keep photos on disk',
    );
  }
  if (result.data.NODE_ENV === 'production' && !result.data.REDIS_URL) {
    throw new Error('Invalid environment variables:\n✖ REDIS_URL is required in production');
  }
  return result.data;
}
