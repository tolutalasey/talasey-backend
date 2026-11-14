import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
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
import type { SampleRequestRow } from './samples.repository.js';
import {
  newSampleOfferSchema,
  sampleOfferChangesSchema,
  sampleOfferSchema,
  sampleRequestInputSchema,
  sampleRequestPlacedSchema,
  sampleRequestQuerySchema,
  sampleRequestSchema,
  type SampleOffer,
  type SampleRequestDto,
  type SampleRequestInput,
} from './samples.schemas.js';
import { SamplesService } from './samples.service.js';

const toDto = (request: SampleRequestRow): SampleRequestDto => ({
  ...request,
  createdAt: request.createdAt.toISOString(),
  dispatchedAt: request.dispatchedAt?.toISOString() ?? null,
});

@ApiTags('store: samples')
@Controller('store/samples')
export class StoreSamplesController {
  constructor(private readonly samples: SamplesService) {}

  @Get('offers')
  @Returns(z.array(sampleOfferSchema))
  offers(): Promise<SampleOffer[]> {
    return this.samples.offers(true);
  }

  @Post()
  @Accepts(sampleRequestInputSchema)
  @Returns(sampleRequestPlacedSchema, 201)
  @Fails([422, 'A postcode or a sample that needs fixing'])
  async request(
    @ValidBody(sampleRequestInputSchema) body: SampleRequestInput,
  ): Promise<z.infer<typeof sampleRequestPlacedSchema>> {
    const result = await this.samples.request(body);
    if (result.status === 'invalid') throw new UnprocessableEntityException(result.problems);
    return { number: result.request.number };
  }
}

@ApiTags('admin: samples')
@Controller('admin/samples')
@StaffOnly('orders')
export class AdminSamplesController {
  constructor(private readonly samples: SamplesService) {}

  @Get('offers')
  @Returns(z.array(sampleOfferSchema))
  offers(): Promise<SampleOffer[]> {
    return this.samples.offers(false);
  }

  @Post('offers')
  @Accepts(newSampleOfferSchema)
  @Returns(z.object({ id: z.uuid() }), 201)
  @Fails([422, 'No product at that address'])
  async createOffer(
    @ValidBody(newSampleOfferSchema) body: z.infer<typeof newSampleOfferSchema>,
  ): Promise<{ id: string }> {
    const result = await this.samples.createOffer(body.productHandle, body.label);
    if (result.status === 'invalid') throw new UnprocessableEntityException(result.problem);
    return { id: result.id };
  }

  @Patch('offers/:id')
  @HttpCode(204)
  @Accepts(sampleOfferChangesSchema)
  async updateOffer(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(sampleOfferChangesSchema) body: z.infer<typeof sampleOfferChangesSchema>,
  ): Promise<void> {
    if (!(await this.samples.updateOffer(id, body))) throw new NotFoundException('No such sample');
  }

  @Delete('offers/:id')
  @HttpCode(204)
  async deleteOffer(@ValidParam('id', z.uuid()) id: string): Promise<void> {
    if (!(await this.samples.deleteOffer(id))) throw new NotFoundException('No such sample');
  }

  @Get('requests')
  @AcceptsQuery(sampleRequestQuerySchema)
  @Returns(z.array(sampleRequestSchema))
  async requests(
    @ValidQuery(sampleRequestQuerySchema) query: z.infer<typeof sampleRequestQuerySchema>,
  ): Promise<SampleRequestDto[]> {
    return (await this.samples.requests(query.status)).map(toDto);
  }

  @Post('requests/:id/dispatch')
  @HttpCode(200)
  @Returns(sampleRequestSchema)
  @Fails([404, 'No such request, or it was already sent'])
  async dispatch(
    @ValidParam('id', z.uuid()) id: string,
    @CurrentStaff() actor: StaffUser,
  ): Promise<SampleRequestDto> {
    const request = await this.samples.dispatch(id, actor);
    if (!request) throw new NotFoundException('No such request, or it was already sent');
    return toDto(request);
  }
}
