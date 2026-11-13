import { Module } from '@nestjs/common';
import { DeliveryAdminController } from './delivery-admin.controller.js';
import { ZoneAdminService } from './zone-admin.service.js';
import { ZoneConfigRepository } from './zone-config.repository.js';

@Module({
  controllers: [DeliveryAdminController],
  providers: [ZoneConfigRepository, ZoneAdminService],
})
export class DeliveryAdminModule {}
