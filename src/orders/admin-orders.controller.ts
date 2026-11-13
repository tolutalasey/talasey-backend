import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { StaffOnly } from '../auth/staff.guard.js';
import { orderSchema, type OrderDto } from '../basket/basket.schemas.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.js';
import { toOrderDto } from './order-dto.js';
import { OrderRepository } from './order.repository.js';

const orderSummarySchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  email: z.string(),
  name: z.string(),
  postcode: z.string(),
  totalPence: z.number().int(),
  shipment: z.enum(['pallet', 'parcel']),
  day: z.iso.date().nullable(),
  dayStatus: z.enum(['held', 'booked', 'needs-rebooking']).nullable(),
  paymentStatus: z.enum(['paid', 'partly_refunded', 'refunded']),
  createdAt: z.iso.datetime(),
});

const refundSchema = z.object({ amountPence: z.number().int().positive() });

@ApiTags('admin: orders')
@Controller('admin/orders')
@StaffOnly('orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrderRepository,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  @Get()
  @Returns(z.array(orderSummarySchema))
  async list(): Promise<z.infer<typeof orderSummarySchema>[]> {
    const orders = await this.orders.list(200);
    return orders.map((order) => ({
      id: order.id,
      number: order.number,
      email: order.email,
      name: `${order.address.firstName} ${order.address.lastName}`,
      postcode: order.address.postcode,
      totalPence: order.totalPence,
      shipment: order.shipment,
      day: order.slot?.date ?? null,
      dayStatus: order.slot?.status ?? null,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
    }));
  }

  @Get(':id')
  @Returns(orderSchema)
  @Fails([404, 'No such order'])
  async find(@ValidParam('id', z.uuid()) id: string): Promise<OrderDto> {
    const order = await this.orders.find(id);
    if (!order) throw new NotFoundException('No such order');
    return toOrderDto(order);
  }

  // Refunds go back the way the customer paid: through Stripe, or nowhere for a test payment.
  @Post(':id/refunds')
  @HttpCode(200)
  @Accepts(refundSchema)
  @Returns(orderSchema)
  @Fails([404, 'No such order'], [422, 'More than is left to refund'])
  async refund(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(refundSchema) body: z.infer<typeof refundSchema>,
  ): Promise<OrderDto> {
    const order = await this.orders.find(id);
    if (!order) throw new NotFoundException('No such order');
    const left = order.totalPence - order.refundedPence;
    if (body.amountPence > left) {
      throw new UnprocessableEntityException(`Only £${(left / 100).toFixed(2)} is left to refund`);
    }
    if (order.paymentProvider !== this.payments.name) {
      throw new UnprocessableEntityException(
        `This order was paid with the ${order.paymentProvider} payment, which is not set up here`,
      );
    }
    await this.payments.refund(order.paymentReference, body.amountPence);
    await this.orders.recordRefund(id, order.refundedPence + body.amountPence, order.totalPence);
    return toOrderDto((await this.orders.find(id)) ?? order);
  }
}
