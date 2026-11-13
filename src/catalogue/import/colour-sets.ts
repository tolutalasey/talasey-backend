import type { PimColourSet, PimProduct } from './pim-source.js';

// Screen swatches only: the closest sRGB shade to each RAL colour named in the master sheet.
// A colour with no code, or a code not listed here, gets a neutral grey until someone picks one.
const RAL_HEX: Record<string, string> = {
  'RAL 5014': '#637D96',
  'RAL 6005': '#0F4336',
  'RAL 6021': '#89AC76',
  'RAL 7016': '#383E42',
  'RAL 7035': '#CBD0CC',
  'RAL 8017': '#45302B',
  'RAL 9005': '#0A0A0A',
  'RAL 9010': '#F1ECE1',
};

const UNKNOWN_SHADE = '#9E9E9E';

export const colourSetName = (key: string) => {
  const words = key.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export interface NewColour {
  name: string;
  hex: string;
  rank: number;
}

export interface ExistingColourSet {
  id: string;
  name: string;
  colours: { name: string }[];
}

export interface ColourSetPlan {
  create: { key: string; name: string; colours: NewColour[] }[];
  addColours: { key: string; setId: string; colours: NewColour[] }[];
}

const toColours = (set: PimColourSet): NewColour[] =>
  set.colours.map((colour, rank) => ({
    name: colour.code ? `${colour.name} (${colour.code})` : colour.name,
    hex: (colour.code && RAL_HEX[colour.code.toUpperCase()]) || UNKNOWN_SHADE,
    rank,
  }));

// Sets are matched by name; colours already in a set are left as they are, so swatches and
// photos changed in the admin survive the next import.
export function planColourSets(
  sheet: PimColourSet[],
  existing: ExistingColourSet[],
): ColourSetPlan {
  const byName = new Map(existing.map((set) => [set.name, set]));
  const plan: ColourSetPlan = { create: [], addColours: [] };
  for (const set of sheet) {
    const name = colourSetName(set.key);
    const colours = toColours(set);
    const found = byName.get(name);
    if (!found) {
      plan.create.push({ key: set.key, name, colours });
      continue;
    }
    const known = new Set(found.colours.map((colour) => colour.name));
    const missing = colours.filter((colour) => !known.has(colour.name));
    if (missing.length > 0)
      plan.addColours.push({ key: set.key, setId: found.id, colours: missing });
  }
  return plan;
}

export interface NewProfile {
  product_id: string;
  page_type: '1B';
  colour_set_id: string;
  colour_option: string | null;
  colour_option_value: string | null;
  colour_required: boolean;
}

// A product that names a colour set in the sheet becomes page type 1B (the SKU is size and finish,
// the colour is chosen from the set). Products that already have a profile keep it.
export function planProfiles(
  products: PimProduct[],
  productIds: Map<string, string>,
  setIds: Map<string, string>,
  withProfile: Set<string>,
): NewProfile[] {
  return products.flatMap((product) => {
    const key = product.attributes.colour_set;
    const productId = productIds.get(product.handle);
    const setId = key ? setIds.get(key) : undefined;
    if (!productId || !setId || withProfile.has(productId)) return [];
    return [
      {
        product_id: productId,
        page_type: '1B',
        colour_set_id: setId,
        colour_option: product.attributes.colour_when ?? null,
        colour_option_value: product.attributes.colour_values ?? null,
        colour_required: product.attributes.colour_required !== 'no',
      },
    ];
  });
}
