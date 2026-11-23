import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Accepts, Fails, Returns, ValidBody } from '../common/contract.js';
import {
  assistantReplySchema,
  assistantRequestSchema,
  assistantStatusSchema,
  type AssistantReply,
  type AssistantRequest,
} from './assistant.schemas.js';
import { AssistantService } from './assistant.service.js';

// The site's server passes the shopper's address on, since every request reaches us from it.
// Only a hash is kept, for the hourly limit.
function visitorKey(forwarded: string | undefined, ip: string): string {
  const address = forwarded?.split(',')[0]?.trim() || ip;
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}

@ApiTags('store: assistant')
@Controller('store/assistant')
export class StoreAssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get()
  @Returns(assistantStatusSchema)
  status(): z.infer<typeof assistantStatusSchema> {
    return { enabled: this.assistant.enabled };
  }

  @Post('messages')
  @HttpCode(200)
  @Accepts(assistantRequestSchema)
  @Returns(assistantReplySchema)
  @Fails(
    [429, 'Too many messages for now'],
    [503, 'The assistant is switched off or could not answer'],
  )
  async message(
    @ValidBody(assistantRequestSchema) body: AssistantRequest,
    @Headers('x-visitor-ip') forwarded: string | undefined,
    @Ip() ip: string,
  ): Promise<AssistantReply> {
    const result = await this.assistant.reply(body, visitorKey(forwarded, ip));
    if (result.ok) return { reply: result.reply, products: result.products };
    if (result.reason === 'busy') {
      throw new HttpException('Too many messages for now', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new ServiceUnavailableException(
      result.reason === 'off' ? 'The assistant is switched off' : 'The assistant could not answer',
    );
  }
}
