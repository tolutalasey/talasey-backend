import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentStaff, StaffOnly } from '../auth/staff.guard.js';
import type { StaffUser } from '../auth/staff-user.repository.js';
import {
  Accepts,
  AcceptsQuery,
  Fails,
  Returns,
  ValidBody,
  ValidParam,
  ValidQuery,
} from '../common/contract.js';
import { CONTENT_TYPES, contentType, problemsOf } from './content-types.js';
import type { ContentDocument } from './content.repository.js';
import {
  contentDocumentSchema,
  contentDraftSchema,
  contentListQuerySchema,
  contentSummarySchema,
  contentTypeSchema,
  newContentSchema,
  type ContentDocumentDto,
} from './content.schemas.js';
import { canPublish, ContentService, type ContentResult } from './content.service.js';

// Singletons (the homepage, navigation) are named by their type; everything else by its title,
// or by its key (a product's address, a redirect's old path) when it has no title.
const titleOf = (document: ContentDocument) =>
  String(
    document.draft.title ??
      document.draft.name ??
      document.draft.question ??
      (contentType(document.type)?.singleton ? contentType(document.type)?.label : document.key) ??
      document.key,
  );

const summary = (document: ContentDocument) => ({
  id: document.id,
  type: document.type,
  key: document.key,
  title: titleOf(document),
  status: document.status,
  updatedBy: document.updatedBy,
  updatedAt: document.updatedAt.toISOString(),
});

@ApiTags('content')
@Controller('content')
@StaffOnly('content.edit')
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Get('types')
  @Returns(z.array(contentTypeSchema))
  types(@CurrentStaff() user: StaffUser): z.infer<typeof contentTypeSchema>[] {
    return CONTENT_TYPES.map(({ type, label, singleton, locked, fields }) => ({
      type,
      label,
      singleton,
      locked,
      fields,
      canPublish: canPublish({ locked } as never, user.role),
    }));
  }

  @Get('documents')
  @AcceptsQuery(contentListQuerySchema)
  @Returns(z.array(contentSummarySchema))
  async list(@ValidQuery(contentListQuerySchema) query: z.infer<typeof contentListQuerySchema>) {
    return (await this.content.list(query.type)).map(summary);
  }

  @Post('documents')
  @Accepts(newContentSchema)
  @Returns(contentDocumentSchema, 201)
  @Fails([404, 'No such content type'], [422, 'The address is already used'])
  async create(
    @ValidBody(newContentSchema) body: z.infer<typeof newContentSchema>,
    @CurrentStaff() user: StaffUser,
  ): Promise<ContentDocumentDto> {
    return this.dto(await this.content.create(body.type, body.data, user), user);
  }

  @Get('documents/:id')
  @Returns(contentDocumentSchema)
  @Fails([404, 'No such document'])
  async find(@ValidParam('id', z.uuid()) id: string, @CurrentStaff() user: StaffUser) {
    const document = await this.content.find(id);
    if (!document) throw new NotFoundException('No such document');
    const definition = contentType(document.type);
    return this.toDto(document, definition ? problemsOf(definition, document.draft) : [], user);
  }

  @Put('documents/:id')
  @Accepts(contentDraftSchema)
  @Returns(contentDocumentSchema)
  @Fails([404, 'No such document'], [422, 'The address is already used'])
  async save(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(contentDraftSchema) body: z.infer<typeof contentDraftSchema>,
    @CurrentStaff() user: StaffUser,
  ): Promise<ContentDocumentDto> {
    return this.dto(await this.content.saveDraft(id, body.data, user), user);
  }

  @Post('documents/:id/publish')
  @HttpCode(200)
  @Returns(contentDocumentSchema)
  @Fails([403, 'Contributors cannot publish'], [422, 'Something needs fixing first'])
  async publish(@ValidParam('id', z.uuid()) id: string, @CurrentStaff() user: StaffUser) {
    return this.dto(await this.content.publish(id, user), user);
  }

  @Post('documents/:id/unpublish')
  @HttpCode(200)
  @Returns(contentDocumentSchema)
  @Fails([403, 'Contributors cannot unpublish'])
  async unpublish(@ValidParam('id', z.uuid()) id: string, @CurrentStaff() user: StaffUser) {
    return this.dto(await this.content.unpublish(id, user), user);
  }

  @Delete('documents/:id')
  @HttpCode(204)
  @Fails([403, 'Contributors cannot delete'])
  async remove(@ValidParam('id', z.uuid()) id: string, @CurrentStaff() user: StaffUser) {
    const result = await this.content.remove(id, user);
    if (result.status !== 'saved') this.dto(result, user);
  }

  private dto(result: ContentResult, user: StaffUser): ContentDocumentDto {
    switch (result.status) {
      case 'saved':
        return this.toDto(result.document, result.problems, user);
      case 'not-found':
        throw new NotFoundException('No such document');
      case 'not-allowed':
        throw new ForbiddenException(result.problem);
      case 'invalid':
        throw new UnprocessableEntityException(result.problems);
    }
  }

  private toDto(
    document: ContentDocument,
    problems: string[],
    user: StaffUser,
  ): ContentDocumentDto {
    const definition = contentType(document.type);
    return {
      ...summary(document),
      draft: document.draft,
      published: document.published,
      publishedBy: document.publishedBy,
      publishedAt: document.publishedAt?.toISOString() ?? null,
      problems,
      canPublish: definition ? canPublish(definition, user.role) : false,
    };
  }
}
