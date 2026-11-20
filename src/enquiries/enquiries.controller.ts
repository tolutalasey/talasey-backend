import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Res,
  UnprocessableEntityException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { StaffOnly } from '../auth/staff.guard.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import {
  enquiryInputSchema,
  enquirySchema,
  enquiryStatusSchema,
  MAX_ENQUIRY_PHOTO_BYTES,
  MAX_ENQUIRY_PHOTOS,
  type EnquiryDto,
} from './enquiries.schemas.js';
import { EnquiriesService } from './enquiries.service.js';

@ApiTags('store: enquiries')
@Controller('store/enquiries')
export class StoreEnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  // A contact message or a site survey request, with up to five photos.
  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', MAX_ENQUIRY_PHOTOS, {
      limits: { fileSize: MAX_ENQUIRY_PHOTO_BYTES, files: MAX_ENQUIRY_PHOTOS },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object' } })
  @Returns(z.object({ id: z.uuid() }), 201)
  @Fails([422, 'A field is missing or a photo is the wrong kind'])
  async submit(
    @Body() body: unknown,
    @UploadedFiles() files: { buffer: Buffer }[] | undefined,
  ): Promise<{ id: string }> {
    const parsed = enquiryInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException(parsed.error.issues.map((issue) => issue.message));
    }
    const result = await this.enquiries.submit(
      parsed.data,
      (files ?? []).map((file) => file.buffer),
    );
    if (!result.ok) throw new UnprocessableEntityException(result.problems);
    return { id: result.id };
  }
}

@ApiTags('admin: enquiries')
@Controller('admin/enquiries')
@StaffOnly('enquiries')
export class AdminEnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Get()
  @Returns(z.array(enquirySchema))
  list(): Promise<EnquiryDto[]> {
    return this.enquiries.list();
  }

  @Get(':id')
  @Returns(enquirySchema)
  @Fails([404, 'No such enquiry'])
  async find(@ValidParam('id', z.uuid()) id: string): Promise<EnquiryDto> {
    const enquiry = await this.enquiries.find(id);
    if (!enquiry) throw new NotFoundException('No such enquiry');
    return enquiry;
  }

  @Patch(':id')
  @Accepts(enquiryStatusSchema)
  @Returns(enquirySchema)
  @Fails([404, 'No such enquiry'])
  async setStatus(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(enquiryStatusSchema) body: z.infer<typeof enquiryStatusSchema>,
  ): Promise<EnquiryDto> {
    const enquiry = await this.enquiries.setStatus(id, body.status);
    if (!enquiry) throw new NotFoundException('No such enquiry');
    return enquiry;
  }

  // Customers' garden photos are never public: staff open them through here.
  @Get(':id/photos/:number')
  @Fails([404, 'No such photo'])
  async photo(
    @ValidParam('id', z.uuid()) id: string,
    @ValidParam('number', z.coerce.number().int().min(1).max(MAX_ENQUIRY_PHOTOS)) number: number,
    @Res() response: Response,
  ) {
    const photo = await this.enquiries.photo(id, number);
    if (!photo) throw new NotFoundException('No such photo');
    response.setHeader('Content-Type', photo.contentType);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.send(photo.bytes);
  }
}
