import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentStaff, StaffOnly } from '../auth/staff.guard.js';
import type { StaffUser } from '../auth/staff-user.repository.js';
import { CLOCK, type Clock } from '../common/clock.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import {
  newReleaseSchema,
  releaseItemSchema,
  releaseScheduleSchema,
  releaseSchema,
  type ReleaseDto,
} from './content.schemas.js';
import { ReleaseService, type ReleaseResult, type ReleaseWithItems } from './release.service.js';

const toDto = (release: ReleaseWithItems): ReleaseDto => ({
  id: release.id,
  name: release.name,
  status: release.status,
  publishAt: release.publishAt?.toISOString() ?? null,
  scheduledBy: release.scheduledBy,
  createdBy: release.createdBy,
  publishedAt: release.publishedAt?.toISOString() ?? null,
  problems: release.problems,
  items: release.items,
});

function releaseOrThrow(result: ReleaseResult): ReleaseDto {
  switch (result.status) {
    case 'ok':
      return toDto(result.release);
    case 'not-found':
      throw new NotFoundException('No such release or document');
    case 'not-allowed':
      throw new ForbiddenException(result.problem);
    case 'invalid':
      throw new UnprocessableEntityException(result.problems);
  }
}

const releaseId = () => ValidParam('id', z.uuid());

@ApiTags('content releases')
@Controller('content/releases')
@StaffOnly('content.publish')
export class ReleaseController {
  constructor(
    private readonly releases: ReleaseService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @Returns(z.array(releaseSchema))
  async list(): Promise<ReleaseDto[]> {
    return (await this.releases.list()).map(toDto);
  }

  @Post()
  @Accepts(newReleaseSchema)
  @Returns(releaseSchema, 201)
  async create(
    @ValidBody(newReleaseSchema) body: z.infer<typeof newReleaseSchema>,
    @CurrentStaff() user: StaffUser,
  ): Promise<ReleaseDto> {
    return releaseOrThrow(await this.releases.create(body.name, user));
  }

  @Post(':id/items')
  @HttpCode(200)
  @Accepts(releaseItemSchema)
  @Returns(releaseSchema)
  @Fails([403, 'Locked wording, or the release is live'], [422, 'Already in another release'])
  async add(
    @releaseId() id: string,
    @ValidBody(releaseItemSchema) body: z.infer<typeof releaseItemSchema>,
    @CurrentStaff() user: StaffUser,
  ): Promise<ReleaseDto> {
    return releaseOrThrow(await this.releases.addDocument(id, body.documentId, user));
  }

  @Delete(':id/items/:documentId')
  @Returns(releaseSchema)
  async removeItem(
    @releaseId() id: string,
    @ValidParam('documentId', z.uuid()) documentId: string,
  ): Promise<ReleaseDto> {
    return releaseOrThrow(await this.releases.removeDocument(id, documentId));
  }

  @Post(':id/schedule')
  @HttpCode(200)
  @Accepts(releaseScheduleSchema)
  @Returns(releaseSchema)
  @Fails([422, 'Empty, or the time has passed'])
  async schedule(
    @releaseId() id: string,
    @ValidBody(releaseScheduleSchema) body: z.infer<typeof releaseScheduleSchema>,
    @CurrentStaff() user: StaffUser,
  ): Promise<ReleaseDto> {
    return releaseOrThrow(
      await this.releases.schedule(id, new Date(body.publishAt), user, this.clock()),
    );
  }

  @Post(':id/unschedule')
  @HttpCode(200)
  @Returns(releaseSchema)
  async unschedule(@releaseId() id: string): Promise<ReleaseDto> {
    return releaseOrThrow(await this.releases.unschedule(id));
  }

  @Post(':id/publish')
  @HttpCode(200)
  @Returns(releaseSchema)
  @Fails([422, 'Something in it needs fixing first; nothing was published'])
  async publish(@releaseId() id: string, @CurrentStaff() user: StaffUser): Promise<ReleaseDto> {
    return releaseOrThrow(await this.releases.publishNow(id, user, this.clock()));
  }

  @Delete(':id')
  @HttpCode(204)
  @Fails([403, 'Already live'])
  async remove(@releaseId() id: string): Promise<void> {
    releaseOrThrow(await this.releases.remove(id));
  }
}
