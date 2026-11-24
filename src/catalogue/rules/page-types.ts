// PRD section 10: every product is one of five page types, and the type decides how it is
// stored, priced, stocked and added to the basket.
export const PAGE_TYPES = ['1A', '1B', '2', '3', '4'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  '1A': 'Standard: every colour and size is its own SKU',
  '1B': 'Standard with a colour set: SKU is size and finish, colour chosen separately',
  '2': 'Made to measure: priced from the customer’s sizes',
  '3': 'Enquiry only: no basket, an enquiry form',
  '4': 'Build your own: several SKUs chosen step by step',
};

export const ENQUIRY_ONLY: PageType = '3';

export const usesColourSet = (pageType: PageType | null) => pageType === '1B' || pageType === '2';
