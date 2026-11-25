import { ENQUIRY_ONLY, usesColourSet } from './page-types.js';
import type { ColourSetSnapshot, ProductCatalogueSnapshot } from './snapshots.js';

const HEX = /^#[0-9A-F]{6}$/i;

export function colourSetProblems(set: ColourSetSnapshot): string[] {
  const problems: string[] = [];
  if (!set.name.trim()) problems.push('Give the colour set a name');
  if (set.colours.length === 0) problems.push('Add at least one colour');
  const names = new Set<string>();
  for (const colour of set.colours) {
    if (!colour.name.trim()) problems.push('Every colour needs a name');
    if (!HEX.test(colour.hex))
      problems.push(`${colour.name || 'A colour'} needs a hex value like #383E42`);
    const key = colour.name.trim().toLowerCase();
    if (names.has(key)) problems.push(`${colour.name} is in the set twice`);
    names.add(key);
  }
  return problems;
}

export function productCatalogueProblems(
  product: ProductCatalogueSnapshot,
  colourIds: Set<string>,
): string[] {
  const problems: string[] = [];
  const { lead_time_min_days: min, lead_time_max_days: max, colour_rule: rule } = product;
  if ((min === null) !== (max === null))
    problems.push('Give both ends of the lead time, or neither');
  if (min !== null && max !== null && (min < 1 || max < min)) {
    problems.push('The lead time runs from a shorter number of days to a longer one');
  }
  // Products without a page type haven't been set up yet, so only their stock mode is kept.
  // Enquiry-only products, and any product not sold online, show no lead time.
  const setUp = product.page_type !== null;
  const sold = product.page_type !== ENQUIRY_ONLY && product.sell_online !== false;
  if (setUp && sold && product.stock_mode && product.stock_mode !== 'stocked' && min === null) {
    problems.push('Made-to-order products need a lead time');
  }
  if (rule && !usesColourSet(product.page_type)) {
    problems.push('Only page types 1B and 2 use a colour set');
  }
  if (rule && (rule.option === null) !== (rule.value === null)) {
    problems.push('Say which option and value show the colours, or leave both empty');
  }
  if (product.images.length > 0 && !rule) problems.push('Colour images need a colour set');
  for (const image of product.images) {
    if (!colourIds.has(image.colour_id)) {
      problems.push(`The ${image.size} ${image.finish} image uses a colour that isn't in the set`);
    }
    if (!image.alt.trim()) problems.push(`The ${image.size} ${image.finish} image needs alt text`);
  }
  return problems;
}
