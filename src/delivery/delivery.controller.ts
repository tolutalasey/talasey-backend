import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { AcceptsQuery, Fails, Returns, ValidQuery } from '../common/contract.js';
import {
  deliveryQuoteQuerySchema,
  deliveryQuoteSchema,
  deliveryZoneSchema,
  type DeliveryQuoteQuery,
} from './delivery.schemas.js';
import { DeliveryService } from './delivery.service.js';
import { parsePostcode, type Postcode } from './postcode.js';

export function requirePostcode(raw: string): Postcode {
  const postcode = parsePostcode(raw);
  if (!postcode) throw new BadRequestException('Enter a full UK postcode, for example M1 1AE');
  return postcode;
}

@ApiTags('delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('zones/:postcode')
  @ApiParam({ name: 'postcode', example: 'M1 1AE' })
  @Returns(deliveryZoneSchema)
  @Fails([400, 'Not a valid UK postcode'], [404, 'We do not deliver to this postcode area yet'])
  async getZone(@Param('postcode') raw: string): Promise<z.infer<typeof deliveryZoneSchema>> {
    const postcode = requirePostcode(raw);
    const zone = await this.delivery.findZone(postcode);
    if (!zone) throw new NotFoundException(`No delivery zone for postcode area ${postcode.area}`);
    return zone;
  }

  @Get('quotes')
  @AcceptsQuery(deliveryQuoteQuerySchema)
  @Returns(deliveryQuoteSchema)
  @Fails(
    [400, 'Invalid postcode, shipment or weight'],
    [404, 'We do not deliver to this postcode area yet'],
    [422, 'No rate for this weight, e.g. too heavy for a parcel'],
  )
  async getQuote(
    @ValidQuery(deliveryQuoteQuerySchema) query: DeliveryQuoteQuery,
  ): Promise<z.infer<typeof deliveryQuoteSchema>> {
    const postcode = requirePostcode(query.postcode);
    const result = await this.delivery.quote(postcode, query.shipment, query.weightKg);

    switch (result.status) {
      case 'quoted':
        return result.quote;
      case 'no-zone':
        throw new NotFoundException(`No delivery zone for postcode area ${result.area}`);
      case 'no-rate':
        throw new UnprocessableEntityException(
          `No ${query.shipment} rate for ${query.weightKg} kg in ${result.zone}`,
        );
    }
  }
}
