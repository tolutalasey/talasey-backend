import {
  Controller,
  Delete,
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
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import {
  PromotionsService,
  type PromotionChange,
  type PromotionRow,
} from './promotions.service.js';

const promotionInputSchema = z.object({
  name: z.string().trim().min(1, 'Name the promotion'),
  code: z
    .string()
    .trim()
    .nullable()
    .transform((code) => code || null)
    .describe('Empty for a promotion that applies by itself'),
  kind: z.enum(['percent', 'amount', 'free_delivery']),
  value: z.number().int().min(0).describe('A percentage, or pence off'),
  minSpendPence: z.number().int().min(0).default(0),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  maxUses: z.number().int().positive().nullable(),
  active: z.boolean().default(true),
});

const promotionSchema = promotionInputSchema.extend({
  id: z.uuid(),
  code: z.string().nullable(),
  uses: z.number().int(),
  createdBy: z.string(),
});

type PromotionDto = z.infer<typeof promotionSchema>;

const toDto = (row: PromotionRow): PromotionDto => ({
  ...row,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt?.toISOString() ?? null,
});

const toInput = (body: z.infer<typeof promotionInputSchema>) => ({
  ...body,
  startsAt: new Date(body.startsAt),
  endsAt: body.endsAt ? new Date(body.endsAt) : null,
});

function savedOrThrow(result: PromotionChange): PromotionDto {
  if (result.status === 'not-found') throw new NotFoundException('No such promotion');
  if (result.status === 'invalid') throw new UnprocessableEntityException(result.problem);
  return toDto(result.promotion);
}

@ApiTags('admin: promotions')
@Controller('admin/promotions')
@StaffOnly('catalogue')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @Returns(z.array(promotionSchema))
  async list(): Promise<PromotionDto[]> {
    return (await this.promotions.list()).map(toDto);
  }

  @Post()
  @Accepts(promotionInputSchema)
  @Returns(promotionSchema, 201)
  @Fails([422, 'Something needs fixing, or the code is taken'])
  async create(
    @ValidBody(promotionInputSchema) body: z.infer<typeof promotionInputSchema>,
    @CurrentStaff() user: StaffUser,
  ): Promise<PromotionDto> {
    return savedOrThrow(await this.promotions.create(toInput(body), user.name));
  }

  @Put(':id')
  @Accepts(promotionInputSchema)
  @Returns(promotionSchema)
  @Fails([404, 'No such promotion'], [422, 'Something needs fixing, or the code is taken'])
  async update(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(promotionInputSchema) body: z.infer<typeof promotionInputSchema>,
  ): Promise<PromotionDto> {
    return savedOrThrow(await this.promotions.update(id, toInput(body)));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@ValidParam('id', z.uuid()) id: string): Promise<void> {
    if (!(await this.promotions.remove(id))) throw new NotFoundException('No such promotion');
  }
}
