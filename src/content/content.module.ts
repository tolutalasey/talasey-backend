import { Module } from '@nestjs/common';
import { ContentAdminController } from './content-admin.controller.js';
import { ContentPreviewService } from './content-preview.service.js';
import { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';
import { ReleaseScheduler } from './release-scheduler.js';
import { ReleaseController } from './release.controller.js';
import { ReleaseService } from './release.service.js';
import { StoreContentController } from './store-content.controller.js';

@Module({
  controllers: [ContentAdminController, ReleaseController, StoreContentController],
  providers: [
    ContentRepository,
    ContentService,
    ContentPreviewService,
    ReleaseService,
    ReleaseScheduler,
  ],
  exports: [ContentService, ReleaseService],
})
export class ContentModule {}
