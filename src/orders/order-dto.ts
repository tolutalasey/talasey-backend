import type { OrderDto } from '../basket/basket.schemas.js';
import { SHIPMENT_NAMES } from '../checkout/delivery-checkout.service.js';
import type { Order } from './order.repository.js';

export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id,
    number: order.number,
    email: order.email,
    address: order.address,
    lines: order.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      title: line.productTitle,
      variantTitle: line.variantTitle ?? '',
      sku: line.sku,
      colour: line.colour,
      quantity: line.quantity,
      unitPricePence: line.unitPricePence,
      totalPence: line.totalPence,
      buildId: line.buildId,
      bespoke: line.bespoke,
      stock: line.stock,
    })),
    itemTotalPence: order.itemTotalPence,
    deliveryPence: order.deliveryPence,
    discountPence: order.discountPence,
    promotions: order.promotions,
    totalPence: order.totalPence,
    delivery: {
      shipment: order.shipment,
      name: order.deliveryName || SHIPMENT_NAMES[order.shipment],
      day: order.slot ? { date: order.slot.date, status: order.slot.status } : null,
      access: order.access,
    },
    payment: {
      provider: order.paymentProvider,
      status: order.paymentStatus,
      refundedPence: order.refundedPence,
    },
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}
