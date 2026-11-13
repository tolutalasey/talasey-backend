import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from './password.js';
import { PERMISSIONS, STAFF_ROLES } from './roles.js';

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const staffUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(STAFF_ROLES),
  active: z.boolean(),
  twoFactor: z.boolean(),
});

export const meSchema = staffUserSchema.extend({
  permissions: z.array(z.enum(PERMISSIONS)),
});

export const sessionSchema = z.object({
  status: z.literal('signed-in'),
  token: z.string(),
  user: meSchema,
});

export const signInResultSchema = z.discriminatedUnion('status', [
  sessionSchema,
  z.object({ status: z.literal('code-needed'), challenge: z.string() }),
]);

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{3} ?\d{3}$/, 'Enter the 6-digit code');

export const signInCodeSchema = z.object({ challenge: z.string().min(1), code: codeSchema });

export const twoFactorCodeSchema = z.object({ code: codeSchema });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH),
});

export const twoFactorSetupSchema = z.object({ secret: z.string(), uri: z.string() });

export const newStaffUserSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  role: z.enum(STAFF_ROLES),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

export const staffUserChangesSchema = z
  .object({
    name: z.string().trim().min(1),
    role: z.enum(STAFF_ROLES),
    active: z.boolean(),
    password: z.string().min(MIN_PASSWORD_LENGTH),
    twoFactor: z.literal(false),
  })
  .partial();

export type SignIn = z.infer<typeof signInSchema>;
export type SignInCode = z.infer<typeof signInCodeSchema>;
export type TwoFactorCode = z.infer<typeof twoFactorCodeSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type NewStaffUserInput = z.infer<typeof newStaffUserSchema>;
export type StaffUserChangesInput = z.infer<typeof staffUserChangesSchema>;
