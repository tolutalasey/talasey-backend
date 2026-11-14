import { describe, expect, it } from 'vitest';
import { applyPromotions, type Promotion } from './promotion-rules.js';

const now = new Date('2026-11-20T10:00:00Z');
const promo = (overrides: Partial<Promotion>): Promotion => ({
  id: overrides.name ?? 'p',
  name: 'Promotion',
  code: null,
  kind: 'percent',
  value: 10,
  minSpendPence: 0,
  startsAt: new Date('2026-11-01T00:00:00Z'),
  endsAt: null,
  maxUses: null,
  uses: 0,
  active: true,
  ...overrides,
});
const basket = { itemsPence: 20_000, deliveryPence: 6_500, code: null as string | null, now };

describe('promotions', () => {
  it('takes a percentage off the products, not the delivery', () => {
    const outcome = applyPromotions([promo({ code: 'SPRING10' })], {
      ...basket,
      code: 'spring10 ',
    });
    expect(outcome).toMatchObject({
      discountPence: 2_000,
      deliveryPence: 6_500,
      codeProblem: null,
    });
    expect(outcome.applied.map((applied) => applied.code)).toEqual(['SPRING10']);
  });

  it('never takes more off than the products cost', () => {
    const outcome = applyPromotions([promo({ code: 'BIG', kind: 'amount', value: 50_000 })], {
      ...basket,
      code: 'BIG',
    });
    expect(outcome.discountPence).toBe(20_000);
  });

  it('uses whichever saves more, the code or the running sale, never both', () => {
    const sale = promo({ name: 'Sale', value: 15 });
    const code = promo({ name: 'Code', code: 'TEN', value: 10 });
    const outcome = applyPromotions([sale, code], { ...basket, code: 'TEN' });
    expect(outcome.discountPence).toBe(3_000);
    expect(outcome.applied.map((applied) => applied.name)).toEqual(['Sale']);
  });

  it('adds free delivery over a spend to a money-off code', () => {
    const free = promo({ name: 'Free delivery', kind: 'free_delivery', minSpendPence: 15_000 });
    const code = promo({ name: 'Code', code: 'FIVER', kind: 'amount', value: 500 });
    const outcome = applyPromotions([free, code], { ...basket, code: 'FIVER' });
    expect(outcome).toMatchObject({ discountPence: 500, deliveryPence: 0 });
    expect(applyPromotions([free], { ...basket, itemsPence: 10_000 }).deliveryPence).toBe(6_500);
  });

  it('runs a sale only between its start and end', () => {
    const sale = promo({
      startsAt: new Date('2026-11-21T00:00:00Z'),
      endsAt: new Date('2026-11-23T00:00:00Z'),
    });
    expect(applyPromotions([sale], basket).discountPence).toBe(0);
    expect(
      applyPromotions([sale], { ...basket, now: new Date('2026-11-22T00:00:00Z') }).discountPence,
    ).toBe(2_000);
  });

  it('explains why a code does not apply', () => {
    const problemFor = (promotion: Promotion, code = 'CODE') =>
      applyPromotions([promotion], { ...basket, code }).codeProblem;
    expect(problemFor(promo({ code: 'CODE' }), 'OTHER')).toMatch(/don't recognise/);
    expect(problemFor(promo({ code: 'CODE', endsAt: new Date('2026-11-10') }))).toBe(
      'That code has ended.',
    );
    expect(problemFor(promo({ code: 'CODE', maxUses: 3, uses: 3 }))).toBe(
      'That code has been used up.',
    );
    expect(problemFor(promo({ code: 'CODE', minSpendPence: 25_000 }))).toBe(
      'Spend £250 or more on products to use that code.',
    );
    expect(problemFor(promo({ code: 'CODE', active: false }))).toMatch(/don't recognise/);
  });
});
