import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';
import { CLOCK, type Clock } from '../common/clock.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { isUniqueViolation } from '../database/errors.js';
import { products, stockAlerts, variants } from '../database/schema/index.js';
import { JobQueue } from '../jobs/job-queue.js';
import { EmailWording } from '../mail/email-wording.js';
import { MAILER, type Mailer } from '../mail/mailer.js';

// Queued by CatalogueChanges after any product change, with the products that changed.
export const CATALOGUE_CHANGED = 'catalogue-changed';

export type AlertResult = 'waiting' | 'available' | 'no-such-option';

@Injectable()
export class StockAlertsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jobs: JobQueue,
    private readonly wording: EmailWording,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    this.jobs.handle<{ handles: string[] }>(CATALOGUE_CHANGED, async ({ handles }) => {
      await this.notifyAvailable(handles);
    });
  }

  // Asking twice for the same option is fine: the person is told once.
  async ask(variantId: string, email: string): Promise<AlertResult> {
    const [option] = await this.db
      .select({
        stock: variants.stockQuantity,
        mode: products.stockMode,
        published: products.published,
      })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(eq(variants.id, variantId));
    if (!option?.published) return 'no-such-option';
    if (option.stock > 0 || option.mode !== 'stocked') return 'available';
    try {
      await this.db.insert(stockAlerts).values({ variantId, email: email.trim().toLowerCase() });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return 'waiting';
  }

  // Emails everyone waiting for an option of these products that can be bought again.
  async notifyAvailable(handles: string[]): Promise<number> {
    if (handles.length === 0) return 0;
    const due = await this.db
      .select({
        id: stockAlerts.id,
        email: stockAlerts.email,
        product: products.title,
        handle: products.handle,
        option: variants.title,
      })
      .from(stockAlerts)
      .innerJoin(variants, eq(variants.id, stockAlerts.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(
        and(
          isNull(stockAlerts.notifiedAt),
          inArray(products.handle, handles),
          eq(products.published, true),
          or(gt(variants.stockQuantity, 0), ne(products.stockMode, 'stocked')),
        ),
      );
    for (const alert of due) {
      const email = await this.wording.render('back-in-stock', {
        product:
          alert.option === alert.product ? alert.product : `${alert.product}, ${alert.option}`,
        link: new URL(`/products/${alert.handle}/`, this.config.WEB_URL).toString(),
      });
      await this.mailer.send({ to: alert.email, ...email });
      await this.db
        .update(stockAlerts)
        .set({ notifiedAt: this.clock() })
        .where(eq(stockAlerts.id, alert.id));
    }
    return due.length;
  }
}
