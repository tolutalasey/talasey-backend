export interface Promotion {
  id: string;
  name: string;
  code: string | null;
  kind: 'percent' | 'amount' | 'free_delivery';
  value: number;
  minSpendPence: number;
  startsAt: Date;
  endsAt: Date | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
}

export interface PricedBasket {
  itemsPence: number;
  deliveryPence: number;
  code: string | null;
  now: Date;
}

export interface PromotionOutcome {
  discountPence: number;
  deliveryPence: number;
  applied: { id: string; name: string; code: string | null }[];
  // Why the code typed in doesn't apply, in words for the customer.
  codeProblem: string | null;
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

export const normaliseCode = (code: string) => code.trim().toUpperCase();

const running = (promotion: Promotion, now: Date) =>
  promotion.active &&
  promotion.startsAt <= now &&
  (promotion.endsAt === null || now < promotion.endsAt);

function discountOf(promotion: Promotion, itemsPence: number): number {
  if (promotion.kind === 'percent') return Math.floor((itemsPence * promotion.value) / 100);
  if (promotion.kind === 'amount') return Math.min(promotion.value, itemsPence);
  return 0;
}

function codeProblem(promotion: Promotion | undefined, basket: PricedBasket): string | null {
  if (!promotion || !promotion.active || promotion.startsAt > basket.now)
    return "We don't recognise that code. Check it and try again.";
  if (promotion.endsAt && basket.now >= promotion.endsAt) return 'That code has ended.';
  if (promotion.maxUses !== null && promotion.uses >= promotion.maxUses)
    return 'That code has been used up.';
  if (basket.itemsPence < promotion.minSpendPence)
    return `Spend ${pounds(promotion.minSpendPence)} or more on products to use that code.`;
  return null;
}

// One money-off at a time, never stacked: the code or the running sale, whichever saves more.
// Free delivery adds to it, from a code or from spending over a threshold.
export function applyPromotions(promotions: Promotion[], basket: PricedBasket): PromotionOutcome {
  const qualifies = (promotion: Promotion) =>
    running(promotion, basket.now) && basket.itemsPence >= promotion.minSpendPence;
  const automatic = promotions.filter(
    (promotion) => promotion.code === null && qualifies(promotion),
  );

  const typed = basket.code ? normaliseCode(basket.code) : null;
  const coded = typed ? promotions.find((promotion) => promotion.code === typed) : undefined;
  const problem = typed ? codeProblem(coded, basket) : null;
  const usable = [...automatic, ...(coded && !problem ? [coded] : [])];

  const money = usable
    .filter((promotion) => promotion.kind !== 'free_delivery')
    .map((promotion) => ({ promotion, saving: discountOf(promotion, basket.itemsPence) }))
    .sort((a, b) => b.saving - a.saving || (a.promotion.code ? -1 : 1))[0];
  const freeDelivery = usable.find((promotion) => promotion.kind === 'free_delivery');

  return {
    discountPence: money?.saving ?? 0,
    deliveryPence: freeDelivery ? 0 : basket.deliveryPence,
    applied: [money?.promotion, freeDelivery]
      .filter((promotion): promotion is Promotion => promotion !== undefined)
      .map(({ id, name, code }) => ({ id, name, code })),
    codeProblem: problem,
  };
}
