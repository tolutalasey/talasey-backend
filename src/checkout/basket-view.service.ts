import { Inject, Injectable } from '@nestjs/common';
import { itemTotal, lineTotal, type Basket } from '../basket/basket.js';
import type { BasketDto } from '../basket/basket.schemas.js';
import { BasketService } from '../basket/basket.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.js';
import { DeliveryCheckoutService, SHIPMENT_NAMES } from './delivery-checkout.service.js';

// The basket as the site shows it: lines priced now, delivery quoted for the chosen way.
@Injectable()
export class BasketViewService {
  constructor(
    private readonly baskets: BasketService,
    private readonly delivery: DeliveryCheckoutService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async view(basket: Basket): Promise<BasketDto> {
    const stock = new Map(this.baskets.stock(basket).map((split) => [split.line_id, split.label]));
    const quote = basket.shipment ? await this.delivery.quote(basket, basket.shipment) : null;
    const items = itemTotal(basket);
    return {
      id: basket.id,
      email: basket.email,
      address: basket.address,
      lines: basket.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        handle: line.handle,
        title: line.productTitle,
        variantId: line.variantId,
        variantTitle: line.variantTitle,
        sku: line.sku,
        colour: line.colour,
        quantity: line.quantity,
        unitPricePence: line.unitPricePence,
        totalPence: lineTotal(line),
        buildId: line.buildId,
        bespoke: line.bespoke,
        stock: stock.get(line.id) ?? '',
      })),
      itemTotalPence: items,
      deliveryPence: quote?.pricePence ?? null,
      deliveryProblem: quote?.problem ?? null,
      totalPence: items + (quote?.pricePence ?? 0),
      delivery: {
        shipment: basket.shipment,
        name: basket.shipment ? SHIPMENT_NAMES[basket.shipment] : null,
        day: basket.slot ? { date: basket.slot.date, status: basket.slot.status } : null,
        access: basket.access,
      },
      orderId: basket.orderId,
      payment: this.payments.name,
    };
  }
}
