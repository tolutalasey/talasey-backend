import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import { STRIPE } from './payments.module.js';

// Payments that finish after the shopper has left the page (Klarna, bank redirects) still place
// the order. Completing is safe to repeat, so the browser and this can both do it.
@ApiExcludeController()
@Controller('payments/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    @Inject(STRIPE) private readonly stripe: Stripe | null,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly checkout: CheckoutService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const secret = this.config.STRIPE_WEBHOOK_SECRET;
    if (!this.stripe || !secret) throw new NotFoundException();
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(request.rawBody ?? '', signature ?? '', secret);
    } catch {
      throw new BadRequestException('Invalid signature');
    }
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const basketId = intent.metadata.basket_id;
      if (basketId) {
        const result = await this.checkout.complete(basketId, intent.id);
        if (!result.ok)
          this.logger.error(`Paid basket ${basketId} could not become an order: ${result.problem}`);
      }
    }
    return { received: true };
  }
}
