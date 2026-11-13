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
  REVALIDATE_SECRET: optional(z.string().min(32)),
});

export type AppConfig = z.infer<typeof configSchema>;

export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  if (result.data.NODE_ENV === 'production' && !result.data.REDIS_URL) {
    throw new Error('Invalid environment variables:\n✖ REDIS_URL is required in production');
  }
  return result.data;
}
