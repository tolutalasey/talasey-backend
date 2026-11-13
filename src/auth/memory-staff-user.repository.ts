import { randomUUID } from 'node:crypto';
import type {
  NewStaffUser,
  StaffUser,
  StaffUserChanges,
  StaffUserRepository,
  StaffUserWithPassword,
} from './staff-user.repository.js';

type StoredUser = Omit<StaffUserWithPassword, 'twoFactor'>;

const withoutPassword = (user: StoredUser): StaffUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  active: user.active,
  twoFactor: user.twoFactorSecret !== null,
});

export class MemoryStaffUserRepository implements StaffUserRepository {
  readonly users: StoredUser[] = [];

  async findByEmail(email: string) {
    const user = this.users.find((candidate) => candidate.email === email.trim().toLowerCase());
    return user ? { ...user, twoFactor: user.twoFactorSecret !== null } : null;
  }

  async findById(id: string) {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? withoutPassword(user) : null;
  }

  async twoFactorSecretOf(id: string) {
    return this.users.find((candidate) => candidate.id === id)?.twoFactorSecret ?? null;
  }

  async list() {
    return this.users.map(withoutPassword);
  }

  async create(user: NewStaffUser) {
    if (this.users.some((existing) => existing.email === user.email.toLowerCase())) {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    }
    const created: StoredUser = {
      ...user,
      email: user.email.toLowerCase(),
      id: randomUUID(),
      active: true,
      twoFactorSecret: null,
    };
    this.users.push(created);
    return withoutPassword(created);
  }

  async update(id: string, changes: StaffUserChanges) {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    Object.assign(user, changes);
    return withoutPassword(user);
  }
}
