import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { DrizzleSlotRepository } from './drizzle-slot.repository.js';
import { SLOT_REPOSITORY } from './slot.repository.js';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';

@Module({
  imports: [DeliveryModule],
  controllers: [SlotsController],
  providers: [SlotsService, { provide: SLOT_REPOSITORY, useClass: DrizzleSlotRepository }],
  exports: [SlotsService],
})
export class SlotsModule {}
