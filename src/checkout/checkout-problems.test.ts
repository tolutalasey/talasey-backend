import { describe, expect, it } from 'vitest';
import type { Basket, BasketLine } from '../basket/basket.js';
import {
  contactProblems,
  deliveryProblems,
  lineProblems,
  slotHoldProblems,
} from './checkout-problems.js';

const line: BasketLine = {
  id: 'l1',
  variantId: 'v1',
  productId: 'p1',
  handle: 'silver-grey-porcelain-paving',
  productTitle: 'Silver grey porcelain paving',
  variantTitle: '600 × 600 mm',
  sku: 'POR-SLV-600',
  published: true,
  pageType: '1A',
  stockMode: 'stocked',
  stockQuantity: 5,
  weightKg: 70,
  options: {},
  quantity: 3,
  unitPricePence: 8999,
  colourId: null,
  colour: null,
  buildId: null,
  buildParts: null,
  bespoke: null,
};

const basket: Basket = {
  id: 'b1',
  email: 'amy@example.com',
  address: {
    firstName: 'Amy',
    lastName: 'Shaw',
    address1: '1 High Street',
    city: 'Manchester',
    postcode: 'M1 1AE',
    phone: '07700900000',
  },
  shipment: 'pallet',
  slot: { holdId: 'h1', postcode: 'M11AE', date: '2026-11-18', zone: 'north-west', status: 'held' },
  access: { vehicleAccess: 'rigid', hardStanding: true, kerbsideOk: true },
  paymentReference: null,
  promotionCode: null,
  orderId: null,
  lines: [line],
};

const hold = {
  id: 'h1',
  zone: 'north-west',
  date: '2026-11-18',
  reference: 'b1',
  status: 'held' as const,
  expiresAt: new Date(),
  active: true,
};

describe('checkout problems', () => {
  it('passes a complete pallet basket', () => {
    expect([
      ...lineProblems(basket),
      ...contactProblems(basket),
      ...deliveryProblems(basket),
      ...slotHoldProblems(basket.slot as never, hold, basket),
    ]).toEqual([]);
  });

  it('will not place a pallet order without a held day and access answers', () => {
    expect(deliveryProblems({ ...basket, slot: null, access: null })).toEqual([
      'Choose a delivery day for your pallet delivery.',
      'Answer the delivery access questions.',
    ]);
    expect(deliveryProblems({ ...basket, shipment: 'parcel', slot: null, access: null })).toEqual(
      [],
    );
  });

  it('refuses a lapsed or moved day', () => {
    const slot = basket.slot as NonNullable<Basket['slot']>;
    expect(slotHoldProblems(slot, { ...hold, active: false }, basket)).toEqual([
      'We could not keep your delivery day. Choose a day again.',
    ]);
    expect(
      slotHoldProblems(slot, hold, {
        ...basket,
        address: { ...(basket.address as NonNullable<Basket['address']>), postcode: 'SK1 1AA' },
      }),
    ).toEqual(['Your delivery postcode has changed. Choose a delivery day again.']);
  });

  it('counts stock across lines of the same option', () => {
    expect(lineProblems({ ...basket, lines: [line, { ...line, id: 'l2' }] })).toEqual([
      'Only 5 of Silver grey porcelain paving (600 × 600 mm) in stock.',
    ]);
    expect(
      lineProblems({
        ...basket,
        lines: [{ ...line, stockMode: 'stocked_then_made_to_order', quantity: 9 }],
      }),
    ).toEqual([]);
  });

  it('stops unpriced and withdrawn products', () => {
    expect(
      lineProblems({
        ...basket,
        lines: [
          { ...line, unitPricePence: null },
          { ...line, id: 'l3', variantId: 'v3', published: false },
        ],
      }),
    ).toEqual([
      'Silver grey porcelain paving has no price yet.',
      'Silver grey porcelain paving is no longer available.',
    ]);
  });
});
