import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { orders, sampleRequests } from '../database/schema/index.js';
import { EmailWording } from '../mail/email-wording.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { toOrderDto } from '../orders/order-dto.js';
import { OrderRepository } from '../orders/order.repository.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import type { AccountDto } from './accounts.schemas.js';

const LINK_MINUTES = 20;
const SESSION_DAYS = 30;
const LINKS_PER_HOUR = 5;
const RECENT = 20;

// Only hashes of tokens are stored, so reading the store does not let anyone sign in.
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const normalise = (email: string) => email.trim().toLowerCase();

// Customers have no password: an account is everything bought or requested with an email
// address, and a link sent to that address proves it is theirs.
@Injectable()
export class AccountsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly wording: EmailWording,
    private readonly orderRepository: OrderRepository,
  ) {}

  // Always looks the same to the caller, so nobody can learn which addresses have orders.
  async sendLink(rawEmail: string): Promise<void> {
    const email = normalise(rawEmail);
    const sent = await this.store.increment(`sign-in-sent:${hash(email)}`, 60 * 60);
    if (sent > LINKS_PER_HOUR) return;

    const token = randomBytes(32).toString('base64url');
    await this.store.set(`sign-in:${hash(token)}`, email, LINK_MINUTES * 60);
    const link = new URL(`/account/sign-in/?token=${token}`, this.config.WEB_URL).toString();
    const message = await this.wording.render('sign-in-link', {
      link,
      minutes: String(LINK_MINUTES),
    });
    await this.mailer.send({ to: email, ...message });
  }

  // A link works once.
  async redeem(token: string): Promise<{ sessionToken: string; email: string } | null> {
    const key = `sign-in:${hash(token)}`;
    const email = await this.store.get(key);
    if (!email) return null;
    await this.store.delete(key);
    const sessionToken = randomBytes(32).toString('base64url');
    await this.store.set(`customer:${hash(sessionToken)}`, email, SESSION_DAYS * 24 * 60 * 60);
    return { sessionToken, email };
  }

  async emailFor(sessionToken: string): Promise<string | null> {
    return this.store.get(`customer:${hash(sessionToken)}`);
  }

  async signOut(sessionToken: string): Promise<void> {
    await this.store.delete(`customer:${hash(sessionToken)}`);
  }

  async account(email: string): Promise<AccountDto> {
    const [orderIds, samples] = await Promise.all([
      this.db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(sql`lower(${orders.email})`, email))
        .orderBy(desc(orders.createdAt))
        .limit(RECENT),
      this.db
        .select()
        .from(sampleRequests)
        .where(eq(sql`lower(${sampleRequests.email})`, email))
        .orderBy(desc(sampleRequests.createdAt))
        .limit(RECENT),
    ]);
    const found = await Promise.all(orderIds.map(({ id }) => this.orderRepository.find(id)));
    return {
      email,
      orders: found.flatMap((order) => (order ? [toOrderDto(order)] : [])),
      samples: samples.map((request) => ({
        number: request.number,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        items: request.items.map(({ productTitle, productHandle, label }) => ({
          productTitle,
          productHandle,
          label,
        })),
      })),
    };
  }
}
