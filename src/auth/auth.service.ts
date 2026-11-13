import { Inject, Injectable } from '@nestjs/common';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import { verifyPassword } from './password.js';
import { SessionService } from './session.service.js';
import {
  STAFF_USER_REPOSITORY,
  type StaffUser,
  type StaffUserRepository,
} from './staff-user.repository.js';

export const MAX_FAILED_SIGN_INS = 5;
const LOCKOUT_SECONDS = 15 * 60;

export type SignInResult =
  | { status: 'signed-in'; token: string; user: StaffUser }
  | { status: 'wrong-details' }
  | { status: 'locked' };

@Injectable()
export class AuthService {
  constructor(
    @Inject(STAFF_USER_REPOSITORY) private readonly users: StaffUserRepository,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    private readonly sessions: SessionService,
  ) {}

  async signIn(email: string, password: string): Promise<SignInResult> {
    const failures = `sign-in-failures:${email.trim().toLowerCase()}`;
    if (Number(await this.store.get(failures)) >= MAX_FAILED_SIGN_INS) return { status: 'locked' };

    const user = await this.users.findByEmail(email);
    const valid = user?.active && (await verifyPassword(password, user.passwordHash));
    if (!user || !valid) {
      await this.store.increment(failures, LOCKOUT_SECONDS);
      return { status: 'wrong-details' };
    }

    await this.store.delete(failures);
    const staff: StaffUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
    };
    return { status: 'signed-in', token: await this.sessions.start(user.id), user: staff };
  }

  async userFor(token: string): Promise<StaffUser | null> {
    const userId = await this.sessions.userIdFor(token);
    const user = userId ? await this.users.findById(userId) : null;
    return user?.active ? user : null;
  }

  signOut(token: string): Promise<void> {
    return this.sessions.end(token);
  }
}
