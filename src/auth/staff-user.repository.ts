import type { StaffRole } from './roles.js';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
}

export interface StaffUserWithPassword extends StaffUser {
  passwordHash: string;
}

export interface NewStaffUser {
  email: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
}

export type StaffUserChanges = Partial<
  Pick<StaffUserWithPassword, 'name' | 'role' | 'active' | 'passwordHash'>
>;

export interface StaffUserRepository {
  findByEmail(email: string): Promise<StaffUserWithPassword | null>;
  findById(id: string): Promise<StaffUser | null>;
  list(): Promise<StaffUser[]>;
  create(user: NewStaffUser): Promise<StaffUser>;
  update(id: string, changes: StaffUserChanges): Promise<StaffUser | null>;
}

export const STAFF_USER_REPOSITORY = Symbol('StaffUserRepository');
