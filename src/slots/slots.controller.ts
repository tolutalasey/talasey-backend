import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Accepts,
  AcceptsQuery,
  Fails,
  Returns,
  ValidBody,
  ValidParam,
  ValidQuery,
} from '../common/contract.js';
import { requirePostcode } from '../delivery/delivery.controller.js';
import type { SlotHold } from './slot.repository.js';
import {
  createSlotHoldSchema,
  holdIdSchema,
  slotAvailabilitySchema,
  slotHoldSchema,
  slotQuerySchema,
  type CreateSlotHold,
  type SlotAvailabilityDto,
  type SlotHoldDto,
  type SlotQuery,
} from './slot.schemas.js';
import { SlotsService } from './slots.service.js';

@ApiTags('delivery slots')
@Controller('delivery')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get('slots')
  @AcceptsQuery(slotQuerySchema)
  @Returns(slotAvailabilitySchema)
  @Fails(
    [400, 'Not a valid UK postcode'],
    [404, 'No delivery zone or no pallet slots for this postcode'],
  )
  async list(@ValidQuery(slotQuerySchema) query: SlotQuery): Promise<SlotAvailabilityDto> {
    const result = await this.slots.availability(requirePostcode(query.postcode));
    if (result.status !== 'available') throw this.notCovered(result);
    return result.availability;
  }

  @Post('slot-holds')
  @Accepts(createSlotHoldSchema)
  @Returns(slotHoldSchema, 201)
  @Fails(
    [400, 'Invalid postcode, date or reference'],
    [404, 'No delivery zone or no pallet slots for this postcode'],
    [409, 'That day is full'],
    [422, 'That date is not offered'],
  )
  async hold(@ValidBody(createSlotHoldSchema) body: CreateSlotHold): Promise<SlotHoldDto> {
    const result = await this.slots.hold(requirePostcode(body.postcode), body.date, body.reference);
    switch (result.status) {
      case 'held':
        return this.toDto(result.hold);
      case 'date-not-offered':
        throw new UnprocessableEntityException(`We don't offer pallet delivery on ${body.date}`);
      case 'full':
        throw new ConflictException(`${body.date} is fully booked`);
      default:
        throw this.notCovered(result);
    }
  }

  @Get('slot-holds/:id')
  @Returns(slotHoldSchema)
  @Fails([404, 'No such hold'])
  async find(@ValidParam('id', holdIdSchema) id: string): Promise<SlotHoldDto> {
    const hold = await this.slots.findHold(id);
    if (!hold) throw new NotFoundException('No such slot hold');
    return this.toDto(hold);
  }

  @Post('slot-holds/:id/confirm')
  @HttpCode(200)
  @Returns(slotHoldSchema, 200, 'Booked. Confirming twice is safe.')
  @Fails([404, 'No such hold'], [409, 'The hold was released, or expired and the day filled up'])
  async confirm(@ValidParam('id', holdIdSchema) id: string): Promise<SlotHoldDto> {
    const result = await this.slots.confirm(id);
    switch (result.status) {
      case 'booked':
        return this.toDto(result.hold);
      case 'not-found':
        throw new NotFoundException('No such slot hold');
      case 'released':
        throw new ConflictException('This slot hold was released');
      case 'full':
        throw new ConflictException('This slot hold expired and the day is now full');
    }
  }

  @Delete('slot-holds/:id')
  @HttpCode(204)
  @Fails([204, 'Released. Booked holds stay booked.'], [404, 'No such hold'])
  async release(@ValidParam('id', holdIdSchema) id: string): Promise<void> {
    const hold = await this.slots.release(id);
    if (!hold) throw new NotFoundException('No such slot hold');
  }

  private notCovered(result: { status: 'no-zone' } | { status: 'no-slots'; zone: string }) {
    return new NotFoundException(
      result.status === 'no-zone'
        ? 'We do not deliver to this postcode area yet'
        : `No pallet delivery slots in ${result.zone}`,
    );
  }

  private toDto(hold: SlotHold): SlotHoldDto {
    return {
      id: hold.id,
      zone: hold.zone,
      date: hold.date,
      reference: hold.reference,
      status: hold.status,
      expiresAt: hold.expiresAt.toISOString(),
      active: this.slots.isActive(hold),
    };
  }
}
