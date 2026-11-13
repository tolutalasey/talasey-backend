import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentStaff, StaffOnly } from '../../auth/staff.guard.js';
import type { StaffUser } from '../../auth/staff-user.repository.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../../common/contract.js';
import {
  zoneConfigInputSchema,
  zoneConfigSchema,
  zoneDaySchema,
  zoneNameSchema,
  type ZoneConfig,
  type ZoneConfigInput,
  type ZoneDay,
} from './zone-config.js';
import { ZoneAdminService } from './zone-admin.service.js';

@ApiTags('admin: delivery')
@Controller('admin/delivery/zones')
@StaffOnly('delivery')
export class DeliveryAdminController {
  constructor(private readonly zones: ZoneAdminService) {}

  @Get()
  @Returns(z.array(zoneConfigSchema))
  list(): Promise<ZoneConfig[]> {
    return this.zones.list();
  }

  @Put(':zone')
  @Accepts(zoneConfigInputSchema)
  @Returns(zoneConfigSchema)
  @Fails([422, 'An area is in another zone, or a rate band is listed twice'])
  async save(
    @ValidParam('zone', zoneNameSchema) zone: string,
    @ValidBody(zoneConfigInputSchema) body: ZoneConfigInput,
    @CurrentStaff() actor: StaffUser,
  ): Promise<ZoneConfig> {
    const result = await this.zones.save(zone, body, actor);
    if (result.status === 'invalid') throw new UnprocessableEntityException(result.problems);
    return result.zone;
  }

  @Delete(':zone')
  @HttpCode(204)
  @Fails([404, 'No such zone'])
  async remove(
    @ValidParam('zone', zoneNameSchema) zone: string,
    @CurrentStaff() actor: StaffUser,
  ): Promise<void> {
    if (!(await this.zones.remove(zone, actor))) throw new NotFoundException('No such zone');
  }

  @Get(':zone/days')
  @Returns(z.array(zoneDaySchema))
  @Fails([404, 'No such zone'])
  async days(@ValidParam('zone', zoneNameSchema) zone: string): Promise<ZoneDay[]> {
    const days = await this.zones.calendar(zone);
    if (!days) throw new NotFoundException('No such zone');
    return days;
  }
}
