import {
  ConflictException,
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
import { CurrentStaff, StaffOnly } from '../../auth/staff.guard.js';
import type { StaffUser } from '../../auth/staff-user.repository.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../../common/contract.js';
import {
  colourSetInputSchema,
  colourSetSchema,
  type ColourSetInput,
} from '../catalogue.schemas.js';
import type { ColourSet } from './colour-set.repository.js';
import { ColourSetService, type ColourSetResult } from './colour-set.service.js';

function setOrThrow(result: ColourSetResult): ColourSet {
  switch (result.status) {
    case 'saved':
      return result.set;
    case 'not-found':
      throw new NotFoundException('No such colour set');
    case 'invalid':
      throw new UnprocessableEntityException(result.problems);
    case 'in-use':
      throw new ConflictException(
        `${result.usedBy} products use this colour set. Move them to another set first.`,
      );
  }
}

@ApiTags('admin: catalogue')
@Controller('admin/colour-sets')
@StaffOnly('catalogue')
export class ColourSetAdminController {
  constructor(private readonly sets: ColourSetService) {}

  @Get()
  @Returns(z.array(colourSetSchema))
  list(): Promise<ColourSet[]> {
    return this.sets.list();
  }

  @Get(':id')
  @Returns(colourSetSchema)
  @Fails([404, 'No such colour set'])
  async find(@ValidParam('id', z.uuid()) id: string): Promise<ColourSet> {
    const set = await this.sets.find(id);
    if (!set) throw new NotFoundException('No such colour set');
    return set;
  }

  @Post()
  @Accepts(colourSetInputSchema)
  @Returns(colourSetSchema, 201)
  @Fails([422, 'The set needs a name, colours and hex values'])
  async create(
    @ValidBody(colourSetInputSchema) body: ColourSetInput,
    @CurrentStaff() actor: StaffUser,
  ): Promise<ColourSet> {
    return setOrThrow(await this.sets.create(body, actor));
  }

  @Put(':id')
  @Accepts(colourSetInputSchema)
  @Returns(colourSetSchema)
  @Fails([404, 'No such colour set'], [422, 'The set needs a name, colours and hex values'])
  async update(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(colourSetInputSchema) body: ColourSetInput,
    @CurrentStaff() actor: StaffUser,
  ): Promise<ColourSet> {
    return setOrThrow(await this.sets.update(id, body, actor));
  }

  @Delete(':id')
  @HttpCode(204)
  @Fails([404, 'No such colour set'], [409, 'Products still use it'])
  async remove(@ValidParam('id', z.uuid()) id: string, @CurrentStaff() actor: StaffUser) {
    setOrThrow(await this.sets.remove(id, actor));
  }
}
