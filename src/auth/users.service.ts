import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { isUniqueViolation } from '../database/errors.js';
import { staffUsers } from '../database/schema/index.js';
import type { Actor } from '../audit/audit-log.js';
import { AuditService } from '../audit/audit.service.js';
import type { NewStaffUserInput, StaffUserChangesInput } from './auth.schemas.js';
import { hashPassword } from './password.js';
import type { StaffRole } from './roles.js';
import {
  STAFF_USER_REPOSITORY,
  type StaffUser,
  type StaffUserRepository,
} from './staff-user.repository.js';

const SUBJECT = 'staff_user';

interface StaffSnapshot {
  name: string;
  role: StaffRole;
  active: boolean;
}

export type StaffChangeResult =
  | { status: 'ok'; user: StaffUser }
  | { status: 'not-found' }
  | { status: 'email-taken' }
  | { status: 'last-owner' };

const snapshot = ({ name, role, active }: StaffUser): StaffSnapshot => ({ name, role, active });

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @Inject(STAFF_USER_REPOSITORY) private readonly users: StaffUserRepository,
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.audit.register<StaffSnapshot>({
      subject: SUBJECT,
      permission: 'users',
      current: async (executor, id) => {
        const [row] = await executor
          .select({ name: staffUsers.name, role: staffUsers.role, active: staffUsers.active })
          .from(staffUsers)
          .where(eq(staffUsers.id, id));
        return row ?? null;
      },
      restore: async (executor, id, state) => {
        await executor
          .update(staffUsers)
          .set({ ...(state ?? { active: false }), updatedAt: sql`now()` })
          .where(eq(staffUsers.id, id));
        return [];
      },
    });
  }

  list() {
    return this.users.list();
  }

  async create(input: NewStaffUserInput, actor: Actor): Promise<StaffChangeResult> {
    try {
      const user = await this.users.create({
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      });
      await this.log(this.db, actor, user, null, snapshot(user));
      return { status: 'ok', user };
    } catch (error) {
      if (isUniqueViolation(error)) return { status: 'email-taken' };
      throw error;
    }
  }

  async update(id: string, input: StaffUserChangesInput, actor: Actor): Promise<StaffChangeResult> {
    const current = await this.users.findById(id);
    if (!current) return { status: 'not-found' };
    const losesOwner =
      current.role === 'owner' &&
      ((input.role !== undefined && input.role !== 'owner') || input.active === false);
    if (losesOwner && (await this.activeOwners()) <= 1) return { status: 'last-owner' };

    const { password, ...changes } = input;
    const user = await this.users.update(id, {
      ...changes,
      ...(password && { passwordHash: await hashPassword(password) }),
    });
    if (!user) return { status: 'not-found' };
    await this.log(this.db, actor, user, snapshot(current), snapshot(user));
    return { status: 'ok', user };
  }

  private async activeOwners() {
    const users = await this.users.list();
    return users.filter((user) => user.role === 'owner' && user.active).length;
  }

  private log(
    executor: Executor,
    actor: Actor,
    user: StaffUser,
    before: StaffSnapshot | null,
    after: StaffSnapshot,
  ) {
    return this.audit.record(executor, actor, {
      subject: SUBJECT,
      subjectId: user.id,
      label: `${user.name} (${user.email})`,
      before,
      after,
    });
  }
}
