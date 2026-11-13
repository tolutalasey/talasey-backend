import { Module } from '@nestjs/common';
import { DELIVERY_RATE_REPOSITORY } from './delivery-rate.repository.js';
import { DELIVERY_ZONE_REPOSITORY } from './delivery-zone.repository.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { DrizzleDeliveryRateRepository } from './drizzle-delivery-rate.repository.js';
import { DrizzleDeliveryZoneRepository } from './drizzle-delivery-zone.repository.js';

@Module({
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    { provide: DELIVERY_ZONE_REPOSITORY, useClass: DrizzleDeliveryZoneRepository },
    { provide: DELIVERY_RATE_REPOSITORY, useClass: DrizzleDeliveryRateRepository },
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
