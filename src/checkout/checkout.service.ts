import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { itemTotal, lineTotal, type Basket } from '../basket/basket.js';
import { BasketRepository } from '../basket/basket.repository.js';
import { BasketService } from '../basket/basket.service.js';
import { JobQueue } from '../jobs/job-queue.js';
import { ORDER_PLACED } from '../orders/order-placed.job.js';
import { OrderRepository } from '../orders/order.repository.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.js';
import { SlotsService } from '../slots/slots.service.js';
import {
  contactProblems,
  deliveryProblems,
  lineProblems,
  slotHoldProblems,
} from './checkout-problems.js';
import { DeliveryCheckoutService, SHIPMENT_NAMES } from './delivery-checkout.service.js';

export type CheckoutResult<T> =
  { ok: true; value: T } | { ok: false; problem: string; status: 400 | 402 | 404 };

const refused = (problems: string[], status: 400 | 402 | 404 = 400) =>
  ({ ok: false, problem: problems.join(' '), status }) as const;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly baskets: BasketRepository,
    private readonly basketService: BasketService,
    private readonly delivery: DeliveryCheckoutService,
    private readonly slots: SlotsService,
    private readonly orders: OrderRepository,
    private readonly jobs: JobQueue,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  // Everything that must hold before an order can be placed, as one list of things to fix.
  async problems(
    basket: Basket,
  ): Promise<{ problems: string[]; totalPence: number; deliveryPence: number }> {
    const problems = [
      ...lineProblems(basket),
      ...contactProblems(basket),
      ...deliveryProblems(basket),
    ];
    let deliveryPence = 0;
    if (basket.shipment) {
      const quote = await this.delivery.quote(basket, basket.shipment);
      if (quote.problem || quote.pricePence === null)
        problems.push(quote.problem ?? 'No delivery price.');
      else deliveryPence = quote.pricePence;
    }
    if (problems.length === 0 && basket.shipment === 'pallet' && basket.slot) {
      const hold = await this.slots.findHold(basket.slot.holdId);
      problems.push(
        ...slotHoldProblems(
          basket.slot,
          hold && { ...hold, active: this.slots.isActive(hold) },
          basket,
        ),
      );
    }
    return { problems, totalPence: itemTotal(basket) + deliveryPence, deliveryPence };
  }

  async startPayment(
    basketId: string,
  ): Promise<CheckoutResult<{ clientSecret: string | null; amountPence: number }>> {
    const basket = await this.baskets.find(basketId);
    if (!basket) return refused(['Basket not found'], 404);
    const { problems, totalPence } = await this.problems(basket);
    if (problems.length > 0) return refused(problems);
    const started = await this.payments.start(basket.id, totalPence, basket.paymentReference);
    if (started.reference !== basket.paymentReference) {
      await this.baskets.update(basket.id, { paymentReference: started.reference });
    }
    return { ok: true, value: { clientSecret: started.clientSecret, amountPence: totalPence } };
  }

  // Places the order once. Completing a basket that already has an order returns that order, so a
  // double click or Stripe's webhook arriving after the browser can't place it twice.
  async complete(basketId: string, paymentReference?: string): Promise<CheckoutResult<string>> {
    const basket = await this.baskets.find(basketId);
    if (!basket) return refused(['Basket not found'], 404);
    if (basket.orderId) return { ok: true, value: basket.orderId };

    const { problems, totalPence, deliveryPence } = await this.problems(basket);
    if (problems.length > 0) return refused(problems);
    const paid = await this.payments.confirm(
      paymentReference ?? basket.paymentReference,
      totalPence,
      basket.id,
    );
    if (!paid.ok) return refused([paid.problem], 402);

    const orderId = await this.db.transaction(async (tx) => {
      const locked = await this.baskets.find(basketId, tx, true);
      if (!locked || locked.orderId) return locked?.orderId ?? null;
      const stock = new Map(
        this.basketService.stock(locked).map((split) => [split.line_id, split]),
      );
      const id = await this.orders.create(
        tx,
        {
          basketId: locked.id,
          email: locked.email ?? '',
          address: locked.address as NonNullable<Basket['address']>,
          shipment: locked.shipment ?? 'parcel',
          deliveryName: SHIPMENT_NAMES[locked.shipment ?? 'parcel'],
          itemTotalPence: itemTotal(locked),
          deliveryPence,
          totalPence,
          slot: locked.shipment === 'pallet' ? locked.slot : null,
          access: locked.shipment === 'pallet' ? locked.access : null,
          paymentProvider: this.payments.name,
          paymentReference: paid.reference,
        },
        locked.lines.map((line) => ({
          variantId: line.variantId,
          productTitle: line.productTitle,
          variantTitle: line.variantTitle,
          sku: line.sku,
          colour: line.colour,
          quantity: line.quantity,
          unitPricePence: line.unitPricePence ?? 0,
          totalPence: lineTotal(line),
          stock: stock.get(line.id)?.label ?? '',
          buildId: line.buildId,
          buildParts: line.buildParts,
          bespoke: line.bespoke,
          shipNow: line.stockMode === 'made_to_order' ? 0 : (stock.get(line.id)?.now ?? 0),
        })),
      );
      await this.baskets.update(locked.id, { orderId: id }, tx);
      return id;
    });
    if (!orderId) return refused(['Basket not found'], 404);
    await this.jobs.enqueue(ORDER_PLACED, { orderId });
    return { ok: true, value: orderId };
  }
}
