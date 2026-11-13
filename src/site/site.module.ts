import { Global, Module } from '@nestjs/common';
import { SiteRefresh } from './site-refresh.service.js';

@Global()
@Module({ providers: [SiteRefresh], exports: [SiteRefresh] })
export class SiteModule {}
