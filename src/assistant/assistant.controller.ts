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
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Accepts, Fails, Returns, ValidBody } from '../common/contract.js';
import {
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
    if (!this.assistant.enabled)
      throw new ServiceUnavailableException('The assistant is switched off');
    if (!file) throw new UnprocessableEntityException('Choose a photo to send');
    const result = await this.assistant.savePhoto(file.buffer, visitorKey(forwarded, ip));
    if (result.ok) return { photoId: result.photoId };
    if ('busy' in result) {
      throw new HttpException('Too many photos for now', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new UnprocessableEntityException(result.problem);
  }
}
