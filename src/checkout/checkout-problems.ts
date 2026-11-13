import type { Basket, SlotChoice } from '../basket/basket.js';
import { splitStock } from '../catalogue/rules/stock-mode.js';
import type { SlotHold } from '../slots/slot.repository.js';

const samePostcode = (a: string, b: string) =>
  a.replace(/\s+/g, '').toUpperCase() === b.replace(/\s+/g, '').toUpperCase();

// The lines themselves: still for sale, priced, and in stock where the product is stocked only.
export function lineProblems(basket: Basket): string[] {
  if (basket.lines.length === 0) return ['Your basket is empty.'];
  const problems: string[] = [];
  const wanted = new Map<string, number>();
  for (const line of basket.lines) {
    wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity);
  }
  for (const line of basket.lines) {
    if (!line.published) problems.push(`${line.productTitle} is no longer available.`);
    else if (line.unitPricePence === null) problems.push(`${line.productTitle} has no price yet.`);
  }
  const checked = new Set<string>();
  for (const line of basket.lines) {
    if (checked.has(line.variantId)) continue;
    checked.add(line.variantId);
    const quantity = wanted.get(line.variantId) ?? 0;
    if (!splitStock(line.stockMode, line.stockQuantity, quantity).purchasable) {
      problems.push(
        `Only ${line.stockQuantity} of ${line.productTitle} (${line.variantTitle}) in stock.`,
      );
    }
  }
  return problems;
}

export function contactProblems(basket: Basket): string[] {
  return basket.email && basket.address ? [] : ['Add your email and delivery address.'];
}

// Pallet orders need a held day and the lorry access answers.
export function deliveryProblems(basket: Basket): string[] {
  if (!basket.shipment) return ['Choose how we deliver.'];
  if (basket.shipment !== 'pallet') return [];
  const problems: string[] = [];
  if (!basket.slot) problems.push('Choose a delivery day for your pallet delivery.');
  if (!basket.access) problems.push('Answer the delivery access questions.');
  return problems;
}

// The held day must still be this basket's, for this postcode, and not lapsed.
export function slotHoldProblems(
  slot: SlotChoice,
  hold: (SlotHold & { active: boolean }) | null,
  basket: Pick<Basket, 'id' | 'address'>,
): string[] {
  if (!basket.address || !samePostcode(slot.postcode, basket.address.postcode)) {
    return ['Your delivery postcode has changed. Choose a delivery day again.'];
  }
  if (!hold || !hold.active || hold.reference !== basket.id || hold.date !== slot.date) {
    return ['We could not keep your delivery day. Choose a day again.'];
  }
  return [];
}
