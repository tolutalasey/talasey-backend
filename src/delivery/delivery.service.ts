import { Inject, Injectable } from '@nestjs/common';
import {
  DELIVERY_RATE_REPOSITORY,
  type DeliveryRateRepository,
  type Shipment,
} from './delivery-rate.repository.js';
import {
  DELIVERY_ZONE_REPOSITORY,
  type DeliveryZoneRepository,
} from './delivery-zone.repository.js';
import type { Postcode } from './postcode.js';

export interface PostcodeZone {
  postcode: string;
  area: string;
  zone: string;
  sample: boolean;
}

export interface DeliveryQuote {
  postcode: string;
  zone: string;
  shipment: Shipment;
  weightKg: number;
  pricePence: number;
  requiresSlot: boolean;
  sample: boolean;
}

export type QuoteResult =
  | { status: 'quoted'; quote: DeliveryQuote }
  | { status: 'no-zone'; area: string }
  | { status: 'no-rate'; zone: string };

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DELIVERY_ZONE_REPOSITORY) private readonly zones: DeliveryZoneRepository,
    @Inject(DELIVERY_RATE_REPOSITORY) private readonly rates: DeliveryRateRepository,
  ) {}

  async findZone(postcode: Postcode): Promise<PostcodeZone | null> {
    const match = await this.zones.findByPostcodeArea(postcode.area);
    if (!match) return null;
    return {
      postcode: postcode.formatted,
      area: postcode.area,
      zone: match.zone,
      sample: match.sample,
    };
  }

  async quote(postcode: Postcode, shipment: Shipment, weightKg: number): Promise<QuoteResult> {
    const zone = await this.findZone(postcode);
    if (!zone) return { status: 'no-zone', area: postcode.area };

    const rate = await this.rates.findRate(zone.zone, shipment, weightKg);
    if (!rate) return { status: 'no-rate', zone: zone.zone };

    return {
      status: 'quoted',
      quote: {
        postcode: zone.postcode,
        zone: zone.zone,
        shipment,
        weightKg,
        pricePence: rate.pricePence,
        requiresSlot: shipment === 'pallet',
        sample: zone.sample || rate.sample,
      },
    };
  }
}
