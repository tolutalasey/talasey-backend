import type {
  AccessAnswersRow,
  AddressRow,
  BespokeRow,
  BuildPartRow,
  SampleItemRow,
  SlotChoiceRow,
} from '../database/schema/index.js';
import type { PageType } from '../catalogue/rules/page-types.js';
import type { StockMode } from '../catalogue/rules/stock-mode.js';
import { sampleTotal } from './sample-pricing.js';

export type Address = AddressRow;
export type AccessAnswers = AccessAnswersRow;
export type SlotChoice = SlotChoiceRow;
export type Shipment = 'parcel' | 'pallet';

// A basket line with what the shop knows about its product today.
export interface BasketLine {
  id: string;
  variantId: string;
  productId: string;
  handle: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  published: boolean;
  pageType: PageType | null;
  stockMode: StockMode;
  stockQuantity: number;
  weightKg: number | null;
  options: Record<string, string>;
  quantity: number;
  // The made-to-measure price set when the line was added, or the option's price now.
  unitPricePence: number | null;
  colourId: string | null;
  colour: string | null;
  buildId: string | null;
  buildParts: BuildPartRow[] | null;
  bespoke: BespokeRow | null;
}

export interface Basket {
  id: string;
  email: string | null;
  address: Address | null;
  shipment: Shipment | null;
  slot: SlotChoice | null;
  access: AccessAnswers | null;
  paymentReference: string | null;
  promotionCode: string | null;
  orderId: string | null;
  lines: BasketLine[];
  samples: SampleItemRow[];
}

export const lineTotal = (line: BasketLine) => (line.unitPricePence ?? 0) * line.quantity;
export const itemTotal = (basket: Basket) =>
  basket.lines.reduce((total, line) => total + lineTotal(line), 0) + sampleTotal(basket.samples);

export const isEmpty = (basket: Basket) => basket.lines.length === 0 && basket.samples.length === 0;
export const samplesOnly = (basket: Basket) =>
  basket.lines.length === 0 && basket.samples.length > 0;

// Products bought through a builder (page type 4, the pergolas) have delivery built into their
// price, so they add nothing to the weight delivery is priced on.
export const deliveryIncluded = (line: BasketLine) => line.pageType === '4';

export const onlyDeliveryIncluded = (basket: Basket) =>
  basket.lines.length > 0 && basket.lines.every(deliveryIncluded);

// Delivery is priced on weight, so every other line needs one.
export function basketWeight(basket: Basket): { weightKg: number } | { problem: string } {
  let weightKg = 0;
  for (const line of basket.lines) {
    if (deliveryIncluded(line)) continue;
    if (line.weightKg === null) {
      return { problem: `${line.productTitle} has no weight, so we can't price its delivery.` };
    }
    weightKg += line.weightKg * line.quantity;
  }
  return { weightKg };
}
