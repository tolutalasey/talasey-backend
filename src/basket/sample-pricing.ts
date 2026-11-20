import type { SampleItemRow } from '../database/schema/index.js';

// The scope's sample rules: three free per order, £5 for each one after that, and £5 delivery
// when an order is samples only. Paid goods' delivery covers samples sent with them.
export const FREE_SAMPLES = 3;
export const SAMPLE_PRICE_PENCE = 500;
export const SAMPLE_DELIVERY_PENCE = 500;
export const MAX_SAMPLES = 10;

export const samplePrices = (samples: SampleItemRow[]) =>
  samples.map((sample, index) => ({
    ...sample,
    pricePence: index < FREE_SAMPLES ? 0 : SAMPLE_PRICE_PENCE,
  }));

export const sampleTotal = (samples: SampleItemRow[]) =>
  Math.max(0, samples.length - FREE_SAMPLES) * SAMPLE_PRICE_PENCE;
