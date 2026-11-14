import { Module } from '@nestjs/common';
import { StockAlertsController } from './stock-alerts.controller.js';
import { StockAlertsService } from './stock-alerts.service.js';

@Module({ controllers: [StockAlertsController], providers: [StockAlertsService] })
export class StockAlertsModule {}
