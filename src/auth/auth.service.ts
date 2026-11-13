import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import { hashPassword, verifyPassword } from './password.js';
import { SessionService } from './session.service.js';
import {
  STAFF_USER_REPOSITORY,
  type StaffUser,
  type StaffUserRepository,
} from './staff-user.repository.js';
import { TwoFactorService } from './two-factor.service.js';

export const MAX_FAILED_SIGN_INS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const CHALLENGE_SECONDS = 5 * 60;

export type SignInResult =
  | { status: 'signed-in'; token: string; user: StaffUser }
  | { status: 'code-needed'; challenge: string }
  | { status: 'wrong-details' }
  | { status: 'locked' };

export type CodeResult =
  | { status: 'signed-in'; token: string; user: StaffUser }
  | { status: 'wrong-code' }
  | { status: 'expired' };

interface Challenge {
  userId: string;
  email: string;
}

const failuresKey = (email: string) => `sign-in-failures:${email.trim().toLowerCase()}`;
const challengeKey = (challenge: string) =>
  `sign-in-challenge:${createHash('sha256').update(challenge).digest('hex')}`;

@Injectable()
export class AuthService {
  constructor(
    @Inject(STAFF_USER_REPOSITORY) private readonly users: StaffUserRepository,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sessions: SessionService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async signIn(email: string, password: string): Promise<SignInResult> {
    const failures = failuresKey(email);
    if (await this.isLocked(failures)) return { status: 'locked' };

    const user = await this.users.findByEmail(email);
    const valid = user?.active && (await verifyPassword(password, user.passwordHash));
    if (!user || !valid) {
      await this.store.increment(failures, LOCKOUT_SECONDS);
      return { status: 'wrong-details' };
    }

    if (user.twoFactorSecret) {
      const challenge = randomBytes(32).toString('base64url');
      await this.store.set(
        challengeKey(challenge),
        JSON.stringify({ userId: user.id, email: user.email } satisfies Challenge),
        CHALLENGE_SECONDS,
      );
      return { status: 'code-needed', challenge };
    }

    await this.store.delete(failures);
    const { passwordHash: _password, twoFactorSecret: _secret, ...staff } = user;
    return this.signedIn(staff);
  }

  // The second step for staff with two-factor on. Wrong codes count towards the same lockout as
  // wrong passwords, so the code can't be guessed either.
  async completeSignIn(
    challenge: string,
    code: string,
  ): Promise<CodeResult | { status: 'locked' }> {
    const key = challengeKey(challenge);
    const stored = await this.store.get(key);
    if (!stored) return { status: 'expired' };
    const { userId, email } = JSON.parse(stored) as Challenge;

    const failures = failuresKey(email);
    if (await this.isLocked(failures)) {
      await this.store.delete(key);
      return { status: 'locked' };
    }

    if (!(await this.twoFactor.check(userId, code, this.clock().getTime()))) {
      await this.store.increment(failures, LOCKOUT_SECONDS);
      return { status: 'wrong-code' };
    }

    await this.store.delete(key, failures);
    const user = await this.users.findById(userId);
    return user?.active ? this.signedIn(user) : { status: 'expired' };
  }

  async changePassword(user: StaffUser, current: string, next: string): Promise<boolean> {
    const stored = await this.users.findByEmail(user.email);
    if (!stored || !(await verifyPassword(current, stored.passwordHash))) return false;
    await this.users.update(user.id, { passwordHash: await hashPassword(next) });
    return true;
  }

  async userFor(token: string): Promise<StaffUser | null> {
    const userId = await this.sessions.userIdFor(token);
    const user = userId ? await this.users.findById(userId) : null;
    return user?.active ? user : null;
  }

  signOut(token: string): Promise<void> {
    return this.sessions.end(token);
  }

  private async isLocked(failures: string) {
    return Number(await this.store.get(failures)) >= MAX_FAILED_SIGN_INS;
  }

  private async signedIn(user: StaffUser) {
    return { status: 'signed-in' as const, token: await this.sessions.start(user.id), user };
  }
}
