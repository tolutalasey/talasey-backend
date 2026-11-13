import type { PaymentProvider } from './payment-provider.js';

// For local runs and demos without Stripe keys: no money moves, and the site labels it clearly.
export class TestPaymentProvider implements PaymentProvider {
  readonly name = 'test';

  async start() {
    return { reference: null, clientSecret: null };
  }

  async confirm(_reference: string | null, _amountPence: number, basketId: string) {
    return { ok: true as const, reference: `test_${basketId}` };
  }

  async refund() {}
}
