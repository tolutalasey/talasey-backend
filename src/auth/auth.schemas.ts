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
});

export const meSchema = staffUserSchema.extend({
  permissions: z.array(z.enum(PERMISSIONS)),
});

export const sessionSchema = z.object({ token: z.string(), user: meSchema });

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
  })
  .partial();

export type SignIn = z.infer<typeof signInSchema>;
export type NewStaffUserInput = z.infer<typeof newStaffUserSchema>;
export type StaffUserChangesInput = z.infer<typeof staffUserChangesSchema>;
