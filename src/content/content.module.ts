import { Module } from '@nestjs/common';
import { ContentAdminController } from './content-admin.controller.js';
import { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';
import { StoreContentController } from './store-content.controller.js';

@Module({
  controllers: [ContentAdminController, StoreContentController],
  providers: [ContentRepository, ContentService],
  exports: [ContentService],
})
export class ContentModule {}
