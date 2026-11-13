import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentStaff, StaffOnly } from '../auth/staff.guard.js';
import type { StaffUser } from '../auth/staff-user.repository.js';
import { Fails, Returns, ValidParam } from '../common/contract.js';
import { FILE_STORAGE, type FileStorage } from './file-storage.js';
import { imageInfo } from './image-size.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const uploadedSchema = z.object({
  url: z.string().describe('Where the site loads it from, like /uploads/2026/11/abc.jpg'),
  width: z.number().int(),
  height: z.number().int(),
});

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

@ApiTags('uploads')
@Controller()
export class UploadsController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Post('admin/uploads')
  @StaffOnly('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @Returns(uploadedSchema, 201)
  @Fails([422, 'Not a JPEG, PNG or WebP photo'], [413, 'Bigger than 10 MB'])
  async upload(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @CurrentStaff() _user: StaffUser,
  ): Promise<z.infer<typeof uploadedSchema>> {
    const info = file && imageInfo(file.buffer);
    if (!file || !info) throw new UnprocessableEntityException('Choose a JPEG, PNG or WebP photo');
    const name = `${randomUUID()}.${info.extension}`;
    await this.storage.save(name, file.buffer, info.contentType);
    return { url: `/uploads/${name}`, width: info.width, height: info.height };
  }

  @Get('uploads/:name')
  @ApiExcludeEndpoint()
  async serve(
    @ValidParam('name', z.string().regex(/^[a-f0-9-]{36}\.(jpg|png|webp)$/)) name: string,
    @Res() response: Response,
  ) {
    const bytes = await this.storage.read(name);
    if (!bytes) throw new NotFoundException();
    response
      .type(CONTENT_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream')
      .set('cache-control', 'public, max-age=31536000, immutable')
      .send(bytes);
  }
}
