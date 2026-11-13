export type PaymentProviderName = 'stripe' | 'test';

export interface StartedPayment {
  reference: string | null;
  // Handed to Stripe's Payment Element in the browser; null for the test payment.
  clientSecret: string | null;
}

export type PaymentCheck = { ok: true; reference: string } | { ok: false; problem: string };

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  start(basketId: string, amountPence: number, existing: string | null): Promise<StartedPayment>;
  // Checks the shopper really paid this amount for this basket before the order is placed.
  confirm(reference: string | null, amountPence: number, basketId: string): Promise<PaymentCheck>;
  refund(reference: string, amountPence: number): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PaymentProvider');
