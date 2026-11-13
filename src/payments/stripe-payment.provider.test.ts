import { describe, expect, it, vi } from 'vitest';
import { StripePaymentProvider, type StripeClient } from './stripe-payment.provider.js';

function fakeStripe(
  intent: Partial<Awaited<ReturnType<StripeClient['paymentIntents']['retrieve']>>> = {},
) {
  const stored = {
    id: 'pi_1',
    amount: 10_000,
    status: 'requires_payment_method',
    client_secret: 'pi_1_secret',
    metadata: { basket_id: 'basket_1' },
    ...intent,
  };
  const stripe = {
    paymentIntents: {
      create: vi.fn(async (params) => ({
        ...stored,
        id: 'pi_new',
        amount: params.amount,
        metadata: params.metadata,
      })),
      retrieve: vi.fn(async () => stored),
      update: vi.fn(async (_id, params) => ({ ...stored, amount: params.amount })),
    },
    refunds: { create: vi.fn(async () => ({})) },
  } satisfies StripeClient;
  return { stripe, provider: new StripePaymentProvider(stripe) };
}

describe('StripePaymentProvider', () => {
  it('opens a payment in pounds sterling for the basket total', async () => {
    const { stripe, provider } = fakeStripe();
    await expect(provider.start('basket_1', 12_345, null)).resolves.toEqual({
      reference: 'pi_new',
      clientSecret: 'pi_1_secret',
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
      amount: 12_345,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: { basket_id: 'basket_1' },
    });
  });

  it('reuses the open payment, and updates its amount when the basket changed', async () => {
    const { stripe, provider } = fakeStripe();
    await provider.start('basket_1', 10_000, 'pi_1');
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    await provider.start('basket_1', 11_000, 'pi_1');
    expect(stripe.paymentIntents.update).toHaveBeenCalledWith('pi_1', { amount: 11_000 });
  });

  it('only accepts a payment that succeeded, for this basket and this amount', async () => {
    const paid = fakeStripe({ status: 'succeeded' });
    await expect(paid.provider.confirm('pi_1', 10_000, 'basket_1')).resolves.toEqual({
      ok: true,
      reference: 'pi_1',
    });
    await expect(paid.provider.confirm('pi_1', 10_000, 'basket_2')).resolves.toMatchObject({
      ok: false,
      problem: 'That payment is for a different basket.',
    });
    await expect(paid.provider.confirm('pi_1', 9_000, 'basket_1')).resolves.toMatchObject({
      ok: false,
    });
    await expect(fakeStripe().provider.confirm('pi_1', 10_000, 'basket_1')).resolves.toEqual({
      ok: false,
      problem: 'Your payment has not gone through yet.',
    });
    await expect(paid.provider.confirm(null, 10_000, 'basket_1')).resolves.toMatchObject({
      ok: false,
    });
  });

  it('refunds through Stripe', async () => {
    const { stripe, provider } = fakeStripe({ status: 'succeeded' });
    await provider.refund('pi_1', 2_500);
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_1', amount: 2_500 });
  });
});
