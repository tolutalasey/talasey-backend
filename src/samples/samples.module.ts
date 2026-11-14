import { Module } from '@nestjs/common';
import { AdminSamplesController, StoreSamplesController } from './samples.controller.js';
import { SamplesRepository } from './samples.repository.js';
import { SamplesService } from './samples.service.js';

@Module({
  controllers: [StoreSamplesController, AdminSamplesController],
  providers: [SamplesRepository, SamplesService],
})
export class SamplesModule {}
