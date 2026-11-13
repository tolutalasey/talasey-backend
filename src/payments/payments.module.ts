import { Global, Module } from '@nestjs/common';
import Stripe from 'stripe';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { StripePaymentProvider, type StripeClient } from './stripe-payment.provider.js';
import { TestPaymentProvider } from './test-payment.provider.js';

export const STRIPE = Symbol('Stripe');

// Stripe when its secret key is set; otherwise the labelled test payment.
@Global()
@Module({
  providers: [
    {
      provide: STRIPE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null,
    },
    {
      provide: PAYMENT_PROVIDER,
      inject: [STRIPE],
      useFactory: (stripe: Stripe | null): PaymentProvider =>
        stripe
          ? new StripePaymentProvider(stripe as unknown as StripeClient)
          : new TestPaymentProvider(),
    },
  ],
  exports: [PAYMENT_PROVIDER, STRIPE],
})
export class PaymentsModule {}
