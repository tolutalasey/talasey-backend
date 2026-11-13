import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Fails, Returns, ValidParam } from '../common/contract.js';
import { contentType } from './content-types.js';
import { ContentService } from './content.service.js';

@ApiTags('store: content')
@Controller('store/content')
export class StoreContentController {
  constructor(private readonly content: ContentService) {}

  // Only what has been published; drafts never reach the public site.
  @Get(':type')
  @Returns(z.array(z.record(z.string(), z.unknown())))
  @Fails([404, 'No such content type'])
  async published(@ValidParam('type', z.string()) type: string) {
    if (!contentType(type)) throw new NotFoundException('No such content type');
    return this.content.published(type);
  }
}
