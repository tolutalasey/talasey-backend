import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  NotFoundException,
  Post,
  Put,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { StaffOnly } from '../auth/staff.guard.js';
import {
  Accepts,
  AcceptsQuery,
  Fails,
  Returns,
  ValidBody,
  ValidParam,
  ValidQuery,
} from '../common/contract.js';
import { AssistantLog } from './assistant-log.js';
import {
  assistantStatusAdminSchema,
  assistantSwitchSchema,
  assistantUsageSchema,
  conversationSummarySchema,
  exchangeSchema,
  gapSchema,
  assistantPhotoSchema,
  assistantReplySchema,
  MAX_PHOTO_BYTES,
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

const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

@ApiTags('store: assistant')
@Controller('store/assistant')
export class StoreAssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get()
  @Returns(assistantStatusSchema)
  async status(): Promise<z.infer<typeof assistantStatusSchema>> {
    return { enabled: await this.assistant.isOn() };
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

  // A photo for the next message. The site resizes it to a JPEG in the browser first.
  @Post('photos')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } },
  })
  @Returns(assistantPhotoSchema, 201)
  @Fails(
    [422, 'No photo, or not a JPEG, PNG or WebP under 5 MB'],
    [429, 'Too many photos for now'],
    [503, 'The assistant is switched off'],
  )
  async photo(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Headers('x-visitor-ip') forwarded: string | undefined,
    @Ip() ip: string,
  ): Promise<z.infer<typeof assistantPhotoSchema>> {
    if (!(await this.assistant.isOn())) {
      throw new ServiceUnavailableException('The assistant is switched off');
    }
    if (!file) throw new UnprocessableEntityException('Choose a photo to send');
    const result = await this.assistant.savePhoto(file.buffer, visitorKey(forwarded, ip));
    if (result.ok) return { photoId: result.photoId };
    if ('busy' in result) {
      throw new HttpException('Too many photos for now', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new UnprocessableEntityException(result.problem);
  }
}

@ApiTags('admin: assistant')
@Controller('admin/assistant')
@StaffOnly('enquiries')
export class AdminAssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly log: AssistantLog,
  ) {}

  @Get()
  @Returns(assistantStatusAdminSchema)
  status() {
    return this.assistant.adminStatus();
  }

  @Put('switch')
  @Accepts(assistantSwitchSchema)
  @Returns(assistantStatusAdminSchema)
  async switchTo(@ValidBody(assistantSwitchSchema) body: z.infer<typeof assistantSwitchSchema>) {
    await this.assistant.switchTo(body.on);
    return this.assistant.adminStatus();
  }

  @Get('usage')
  @AcceptsQuery(daysQuery)
  @Returns(assistantUsageSchema)
  usage(@ValidQuery(daysQuery) query: z.infer<typeof daysQuery>) {
    return this.log.usage(query.days);
  }

  @Get('conversations')
  @AcceptsQuery(daysQuery)
  @Returns(z.array(conversationSummarySchema))
  conversations(@ValidQuery(daysQuery) query: z.infer<typeof daysQuery>) {
    return this.log.conversations(query.days);
  }

  @Get('conversations/:id')
  @Returns(z.array(exchangeSchema))
  @Fails([404, 'No such conversation'])
  async conversation(@ValidParam('id', z.uuid()) id: string) {
    const exchanges = await this.log.conversation(id);
    if (exchanges.length === 0) throw new NotFoundException('No such conversation');
    return exchanges;
  }

  @Get('gaps')
  @AcceptsQuery(daysQuery)
  @Returns(z.array(gapSchema))
  gaps(@ValidQuery(daysQuery) query: z.infer<typeof daysQuery>) {
    return this.log.gaps(query.days);
  }
}
