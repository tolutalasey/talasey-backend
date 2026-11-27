import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { AdminEnquiriesController, StoreEnquiriesController } from './enquiries.controller.js';
import { EnquiriesService } from './enquiries.service.js';

@Module({
  imports: [UploadsModule, ContentModule],
  controllers: [StoreEnquiriesController, AdminEnquiriesController],
  providers: [EnquiriesService],
  exports: [EnquiriesService],
})
export class EnquiriesModule {}
