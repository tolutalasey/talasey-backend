import { Module } from '@nestjs/common';
import { BasketRepository } from '../basket/basket.repository.js';
import { BasketService } from '../basket/basket.service.js';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { AdminOrdersController } from '../orders/admin-orders.controller.js';
import { OrderPlacedJob } from '../orders/order-placed.job.js';
import { OrderRepository } from '../orders/order.repository.js';
import { StoreOrdersController } from '../orders/store-orders.controller.js';
import { StripeWebhookController } from '../payments/stripe-webhook.controller.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { SamplesModule } from '../samples/samples.module.js';
import { SlotsModule } from '../slots/slots.module.js';
import { BasketViewService } from './basket-view.service.js';
import { CheckoutService } from './checkout.service.js';
import { DeliveryCheckoutService } from './delivery-checkout.service.js';
import { StoreBasketController } from './store-basket.controller.js';

@Module({
  imports: [CatalogueModule, DeliveryModule, SlotsModule, PromotionsModule, SamplesModule],
  controllers: [
    StoreBasketController,
    StoreOrdersController,
    AdminOrdersController,
    StripeWebhookController,
  ],
  providers: [
    BasketRepository,
    BasketService,
    DeliveryCheckoutService,
    BasketViewService,
    CheckoutService,
    OrderRepository,
    OrderPlacedJob,
  ],
})
export class CheckoutModule {}
