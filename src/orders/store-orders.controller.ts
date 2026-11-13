import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { orderSchema, type OrderDto } from '../basket/basket.schemas.js';
import { Fails, Returns, ValidParam } from '../common/contract.js';
import { toOrderDto } from './order-dto.js';
import { OrderRepository } from './order.repository.js';

@ApiTags('store: basket and checkout')
@Controller('store/orders')
export class StoreOrdersController {
  constructor(private readonly orders: OrderRepository) {}

  // Order ids are random, so knowing one is what lets the confirmation page show it.
  @Get(':id')
  @Returns(orderSchema)
  @Fails([404, 'No such order'])
  async find(@ValidParam('id', z.uuid()) id: string): Promise<OrderDto> {
    const order = await this.orders.find(id);
    if (!order) throw new NotFoundException('No such order');
    return toOrderDto(order);
  }
}
