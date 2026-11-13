import type { PaymentCheck, PaymentProvider, StartedPayment } from './payment-provider.js';

interface PaymentIntent {
  id: string;
  amount: number;
  status: string;
  client_secret: string | null;
  metadata: Record<string, string>;
}

// The parts of the Stripe SDK this uses, so tests can stand in for Stripe.
export interface StripeClient {
  paymentIntents: {
    create(params: {
      amount: number;
      currency: 'gbp';
      automatic_payment_methods: { enabled: true };
      metadata: Record<string, string>;
    }): Promise<PaymentIntent>;
    retrieve(id: string): Promise<PaymentIntent>;
    update(id: string, params: { amount: number }): Promise<PaymentIntent>;
  };
  refunds: {
    create(params: { payment_intent: string; amount: number }): Promise<unknown>;
  };
}

const UPDATABLE = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);

// Cards, Apple Pay, Google Pay and Klarna through Stripe's Payment Element: which methods show is
// switched on in the Stripe dashboard, not here.
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(private readonly stripe: StripeClient) {}

  // Reuses the basket's payment while it can still change, so reloading the page doesn't open a
  // new payment each time.
  async start(
    basketId: string,
    amountPence: number,
    existing: string | null,
  ): Promise<StartedPayment> {
    if (existing) {
      const intent = await this.stripe.paymentIntents.retrieve(existing);
      if (intent.amount === amountPence) return this.started(intent);
      if (UPDATABLE.has(intent.status)) {
        return this.started(
          await this.stripe.paymentIntents.update(existing, { amount: amountPence }),
        );
      }
    }
    const intent = await this.stripe.paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: { basket_id: basketId },
    });
    return this.started(intent);
  }

  async confirm(
    reference: string | null,
    amountPence: number,
    basketId: string,
  ): Promise<PaymentCheck> {
    if (!reference) return { ok: false, problem: 'Pay for your order first.' };
    const intent = await this.stripe.paymentIntents.retrieve(reference);
    if (intent.metadata.basket_id !== basketId) {
      return { ok: false, problem: 'That payment is for a different basket.' };
    }
    if (intent.status !== 'succeeded') {
      return { ok: false, problem: 'Your payment has not gone through yet.' };
    }
    if (intent.amount !== amountPence) {
      return {
        ok: false,
        problem: 'Your basket changed after you paid. Call us and we will sort it out.',
      };
    }
    return { ok: true, reference: intent.id };
  }

  async refund(reference: string, amountPence: number) {
    await this.stripe.refunds.create({ payment_intent: reference, amount: amountPence });
  }

  private started(intent: PaymentIntent): StartedPayment {
    return { reference: intent.id, clientSecret: intent.client_secret };
  }
}
