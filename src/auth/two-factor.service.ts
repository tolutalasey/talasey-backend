import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import {
  STAFF_USER_REPOSITORY,
  type StaffUser,
  type StaffUserRepository,
} from './staff-user.repository.js';
import { matchingStep, newTotpSecret, otpauthUri } from './totp.js';

const SETUP_SECONDS = 10 * 60;
// Long enough to cover the three steps a code is accepted in.
const USED_CODE_SECONDS = 2 * 60;

export type TwoFactorChange = { status: 'ok'; user: StaffUser } | { status: 'wrong-code' };

const setupKey = (userId: string) => `two-factor-setup:${userId}`;
const usedKey = (userId: string, step: number) => `two-factor-used:${userId}:${step}`;

@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(STAFF_USER_REPOSITORY) private readonly users: StaffUserRepository,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // A new secret to add to an authenticator app. It only takes effect once a code from the app
  // proves it was added correctly.
  async begin(user: StaffUser) {
    const secret = newTotpSecret();
    await this.store.set(setupKey(user.id), secret, SETUP_SECONDS);
    return { secret, uri: otpauthUri(secret, user.email) };
  }

  async enable(user: StaffUser, code: string): Promise<TwoFactorChange | { status: 'expired' }> {
    const secret = await this.store.get(setupKey(user.id));
    if (!secret) return { status: 'expired' };
    if (!(await this.consume(user.id, secret, code))) return { status: 'wrong-code' };
    await this.store.delete(setupKey(user.id));
    return this.save(user.id, secret);
  }

  async disable(user: StaffUser, code: string): Promise<TwoFactorChange> {
    if (!(await this.check(user.id, code, this.clock().getTime()))) return { status: 'wrong-code' };
    return this.save(user.id, null);
  }

  // True when the code matches and hasn't been used before, so a code seen over someone's
  // shoulder can't be used a second time.
  async check(userId: string, code: string, now: number): Promise<boolean> {
    const secret = await this.users.twoFactorSecretOf(userId);
    return secret !== null && this.consume(userId, secret, code, now);
  }

  private async consume(
    userId: string,
    secret: string,
    code: string,
    now = this.clock().getTime(),
  ) {
    const step = matchingStep(secret, code, now);
    if (step === null) return false;
    return this.store.setIfAbsent(usedKey(userId, step), '1', USED_CODE_SECONDS * 1000);
  }

  private async save(userId: string, secret: string | null): Promise<TwoFactorChange> {
    const user = await this.users.update(userId, { twoFactorSecret: secret });
    if (!user) throw new Error('Staff user disappeared while changing two-factor');
    return { status: 'ok', user };
  }
}
