import { Injectable } from '@nestjs/common';
import {
  basketWeight,
  onlyDeliveryIncluded,
  type AccessAnswers,
  type Basket,
  type Shipment,
} from '../basket/basket.js';
import { BasketRepository } from '../basket/basket.repository.js';
import { DeliveryService } from '../delivery/delivery.service.js';
import { parsePostcode, type Postcode } from '../delivery/postcode.js';
import { SlotsService } from '../slots/slots.service.js';

export const SHIPMENT_NAMES: Record<Shipment, string> = {
  pallet: 'Pallet delivery on a day you choose',
  parcel: 'Parcel delivery',
};

export interface DeliveryOption {
  shipment: Shipment;
  name: string;
  pricePence: number | null;
  problem: string | null;
}

export type DeliveryResult<T> =
  { ok: true; value: T } | { ok: false; problem: string; status: 400 | 404 | 409 };

const fail = (problem: string, status: 400 | 404 | 409 = 400) =>
  ({ ok: false, problem, status }) as const;

@Injectable()
export class DeliveryCheckoutService {
  constructor(
    private readonly baskets: BasketRepository,
    private readonly delivery: DeliveryService,
    private readonly slots: SlotsService,
  ) {}

  async quote(basket: Basket, shipment: Shipment): Promise<DeliveryOption> {
    const option = { shipment, name: SHIPMENT_NAMES[shipment] };
    const postcode = basket.address && parsePostcode(basket.address.postcode);
    if (!postcode)
      return { ...option, pricePence: null, problem: 'Add a delivery postcode first.' };
    if (onlyDeliveryIncluded(basket)) return this.included(postcode, shipment);
    const weight = basketWeight(basket);
    if ('problem' in weight) return { ...option, pricePence: null, problem: weight.problem };

    const result = await this.delivery.quote(postcode, shipment, weight.weightKg);
    switch (result.status) {
      case 'quoted':
        return { ...option, pricePence: result.quote.pricePence, problem: null };
      case 'no-zone':
        return { ...option, pricePence: null, problem: 'We do not deliver to this postcode yet.' };
      case 'no-rate':
        return {
          ...option,
          pricePence: null,
          problem:
            shipment === 'parcel'
              ? 'Too heavy to send as a parcel.'
              : 'Too heavy for one pallet. Call us and we will arrange it.',
        };
    }
  }

  // A bag of pergola parts comes on a pallet at no charge, wherever we deliver.
  private async included(postcode: Postcode, shipment: Shipment): Promise<DeliveryOption> {
    const option = { shipment, name: SHIPMENT_NAMES[shipment] };
    if (shipment === 'parcel') {
      return { ...option, pricePence: null, problem: 'Pergolas come on a pallet.' };
    }
    const result = await this.delivery.quote(postcode, shipment, 1);
    if (result.status === 'no-zone') {
      return { ...option, pricePence: null, problem: 'We do not deliver to this postcode yet.' };
    }
    return { ...option, pricePence: 0, problem: null };
  }

  options(basket: Basket): Promise<DeliveryOption[]> {
    return Promise.all(
      (['pallet', 'parcel'] as const).map((shipment) => this.quote(basket, shipment)),
    );
  }

  async choose(basket: Basket, shipment: Shipment): Promise<DeliveryResult<void>> {
    const option = await this.quote(basket, shipment);
    if (option.problem) return fail(option.problem);
    if (shipment !== 'pallet' && basket.slot) {
      await this.slots.release(basket.slot.holdId);
      await this.baskets.update(basket.id, { shipment, slot: null });
    } else {
      await this.baskets.update(basket.id, { shipment });
    }
    return { ok: true, value: undefined };
  }

  async days(basket: Basket): Promise<DeliveryResult<{ date: string; remaining: number }[]>> {
    const postcode = basket.address && parsePostcode(basket.address.postcode);
    if (!postcode) return fail('Add a delivery postcode first.');
    const result = await this.slots.availability(postcode);
    if (result.status !== 'available') {
      return fail('We do not have pallet delivery days for this postcode yet.', 404);
    }
    return { ok: true, value: result.availability.slots };
  }

  async holdDay(basket: Basket, date: string): Promise<DeliveryResult<void>> {
    const postcode = basket.address && parsePostcode(basket.address.postcode);
    if (!postcode) return fail('Add a delivery postcode first.');
    const result = await this.slots.hold(postcode, date, basket.id);
    switch (result.status) {
      case 'held':
        await this.baskets.update(basket.id, {
          slot: {
            holdId: result.hold.id,
            postcode: postcode.formatted,
            date: result.hold.date,
            zone: result.hold.zone,
            status: 'held',
          },
        });
        return { ok: true, value: undefined };
      case 'date-not-offered':
        return fail(`We don't offer pallet delivery on ${date}`);
      case 'full':
        return fail(`${date} is fully booked. Choose another day.`, 409);
      default:
        return fail('We do not have pallet delivery days for this postcode yet.', 404);
    }
  }

  async answerAccess(basket: Basket, access: AccessAnswers) {
    await this.baskets.update(basket.id, { access });
  }
}
