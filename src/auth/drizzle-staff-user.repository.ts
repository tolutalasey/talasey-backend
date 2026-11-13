import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { staffUsers } from '../database/schema/index.js';
import type {
  NewStaffUser,
  StaffUser,
  StaffUserChanges,
  StaffUserRepository,
  StaffUserWithPassword,
} from './staff-user.repository.js';

const publicColumns = {
  id: staffUsers.id,
  email: staffUsers.email,
  name: staffUsers.name,
  role: staffUsers.role,
  active: staffUsers.active,
};

const normalise = (email: string) => email.trim().toLowerCase();

@Injectable()
export class DrizzleStaffUserRepository implements StaffUserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByEmail(email: string): Promise<StaffUserWithPassword | null> {
    const [user] = await this.db
      .select({ ...publicColumns, passwordHash: staffUsers.passwordHash })
      .from(staffUsers)
      .where(eq(staffUsers.email, normalise(email)));
    return user ?? null;
  }

  async findById(id: string): Promise<StaffUser | null> {
    const [user] = await this.db
      .select(publicColumns)
      .from(staffUsers)
      .where(eq(staffUsers.id, id));
    return user ?? null;
  }

  list(): Promise<StaffUser[]> {
    return this.db.select(publicColumns).from(staffUsers).orderBy(asc(staffUsers.name));
  }

  async create(user: NewStaffUser): Promise<StaffUser> {
    const [created] = await this.db
      .insert(staffUsers)
      .values({ ...user, email: normalise(user.email) })
      .returning(publicColumns);
    if (!created) throw new Error('Staff user was not created');
    return created;
  }

  async update(id: string, changes: StaffUserChanges): Promise<StaffUser | null> {
    const [user] = await this.db
      .update(staffUsers)
      .set({ ...changes, updatedAt: sql`now()` })
      .where(eq(staffUsers.id, id))
      .returning(publicColumns);
    return user ?? null;
  }
}
