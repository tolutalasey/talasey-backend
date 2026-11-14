import { Module } from '@nestjs/common';
import { OrderRepository } from '../orders/order.repository.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({ controllers: [AccountsController], providers: [AccountsService, OrderRepository] })
export class AccountsModule {}
