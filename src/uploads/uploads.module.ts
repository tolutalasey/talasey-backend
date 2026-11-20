import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { FILE_STORAGE } from './file-storage.js';
import { LocalFileStorage } from './local-file-storage.js';
import { R2FileStorage } from './r2-file-storage.js';
import { UploadsController } from './uploads.controller.js';

@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.R2_ACCOUNT_ID &&
        config.R2_BUCKET &&
        config.R2_ACCESS_KEY_ID &&
        config.R2_SECRET_ACCESS_KEY
          ? new R2FileStorage({
              accountId: config.R2_ACCOUNT_ID,
              bucket: config.R2_BUCKET,
              accessKeyId: config.R2_ACCESS_KEY_ID,
              secretAccessKey: config.R2_SECRET_ACCESS_KEY,
            })
          : new LocalFileStorage(config.UPLOAD_DIR),
    },
  ],
  exports: [FILE_STORAGE],
})
export class UploadsModule {}
