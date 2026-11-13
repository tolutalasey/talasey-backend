import { randomUUID } from 'node:crypto';
import type {
  NewStaffUser,
  StaffUser,
  StaffUserChanges,
  StaffUserRepository,
  StaffUserWithPassword,
} from './staff-user.repository.js';

const withoutPassword = (user: StaffUserWithPassword): StaffUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  active: user.active,
});

export class MemoryStaffUserRepository implements StaffUserRepository {
  readonly users: StaffUserWithPassword[] = [];

  async findByEmail(email: string) {
    return this.users.find((user) => user.email === email.trim().toLowerCase()) ?? null;
  }

  async findById(id: string) {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? withoutPassword(user) : null;
  }

  async list() {
    return this.users.map(withoutPassword);
  }

  async create(user: NewStaffUser) {
    if (this.users.some((existing) => existing.email === user.email.toLowerCase())) {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    }
    const created = { ...user, email: user.email.toLowerCase(), id: randomUUID(), active: true };
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
