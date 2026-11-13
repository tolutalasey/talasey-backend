import { checkBespokeConfig } from '../bespoke/pricing.js';
import type { ProductState } from '../product.js';
import { productCatalogueProblems } from './snapshot-checks.js';

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Everything that must be true before a product is saved, in words staff can act on.
export function productProblems(product: ProductState, colourIds: Set<string>): string[] {
  const problems: string[] = [];
  if (!product.title.trim()) problems.push('Give the product a name');
  if (!HANDLE.test(product.handle)) {
    problems.push('The web address can only use lower-case letters, numbers and hyphens');
  }
  if (product.variants.length === 0) problems.push('A product needs at least one option to sell');

  problems.push(
    ...productCatalogueProblems(
      {
        page_type: product.pageType,
        stock_mode: product.stockMode,
        lead_time_min_days: product.leadTimeMinDays,
        lead_time_max_days: product.leadTimeMaxDays,
        colour_rule: product.colourSetId
          ? {
              colour_set_id: product.colourSetId,
              option: product.colourOption,
              value: product.colourOptionValue,
              required: product.colourRequired,
            }
          : null,
        images: product.colourImages.map((image) => ({
          size: image.size,
          finish: image.finish,
          colour_id: image.colourId,
          url: image.url,
          alt: image.alt,
        })),
      },
      colourIds,
    ),
  );

  if (product.pageType === '2') {
    if (!product.bespoke)
      problems.push('Made-to-measure products need their sizes and price formula');
    else {
      const check = checkBespokeConfig(product.bespoke);
      if (!check.ok) problems.push(...check.problems);
    }
  }
  if (product.pageType !== '2' && product.bespoke) {
    problems.push('Only made-to-measure products (page type 2) have a price formula');
  }

  for (const image of product.images) {
    if (!image.alt.trim()) problems.push('Every photo needs a description (alt text)');
  }

  const optionValues = new Map(product.options.map((option) => [option.title, option.values]));
  for (const variant of product.variants) {
    const name = variant.title || 'An option';
    if (!variant.title.trim()) problems.push('Every option needs a name');
    if (variant.pricePence !== null && variant.pricePence < 0) {
      problems.push(`${name} has a price below zero`);
    }
    for (const [option, value] of Object.entries(variant.options)) {
      if (!optionValues.get(option)?.includes(value)) {
        problems.push(`${name} uses ${option}: ${value}, which the product doesn't offer`);
      }
    }
  }
  return [...new Set(problems)];
}
