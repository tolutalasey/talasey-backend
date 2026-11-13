import type { PageType } from './page-types.js';

export type SkuRule =
  'missing-sku' | 'duplicate-sku' | 'colour-option' | 'colour-in-sku' | 'code-in-name';

export interface CheckedVariant {
  id: string;
  sku: string | null;
  title: string;
}

export interface CheckedProduct {
  id: string;
  title: string;
  pageType: PageType | null;
  options: string[];
  variants: CheckedVariant[];
}

export interface SkuProblem {
  productId: string;
  variantId?: string;
  rule: SkuRule;
  message: string;
}

// The colour codes some screen SKUs carried before colour sets (PRD section 10).
const COLOUR_SUFFIX = /PC(AN|B|W)$/;
const COLOUR_OPTION = /^colou?r$/i;
// Product codes such as SCRDL1800-600PC or EDWOWO250: capitals and digits run together.
const CODE = /\b[A-Z]{2,}\d{2,}[A-Z0-9-]*\b/;

function codeInName(name: string, skus: string[]): boolean {
  return CODE.test(name) || skus.some((sku) => sku.length >= 4 && name.includes(sku));
}

// PRD section 10 SKU rules: every sellable item has one unique SKU; a colour from a colour set
// never makes a SKU; codes stay out of names.
export function checkSkus(products: CheckedProduct[]): SkuProblem[] {
  const owners = new Map<string, CheckedVariant[]>();
  for (const variant of products.flatMap((product) => product.variants)) {
    if (variant.sku) owners.set(variant.sku, [...(owners.get(variant.sku) ?? []), variant]);
  }

  return products.flatMap((product) => {
    const problems: SkuProblem[] = [];
    const add = (rule: SkuRule, message: string, variantId?: string) =>
      problems.push({ productId: product.id, variantId, rule, message });
    const skus = product.variants.flatMap((variant) => (variant.sku ? [variant.sku] : []));

    if (product.pageType === '1B' && product.options.some((option) => COLOUR_OPTION.test(option))) {
      add(
        'colour-option',
        'Colour comes from the colour set on this page type, so it must not be a product option',
      );
    }
    if (codeInName(product.title, skus)) {
      add('code-in-name', `Take the product code out of the name "${product.title}"`);
    }

    for (const variant of product.variants) {
      if (!variant.sku) {
        add('missing-sku', `"${variant.title}" has no SKU`, variant.id);
        continue;
      }
      if ((owners.get(variant.sku)?.length ?? 0) > 1) {
        add('duplicate-sku', `SKU ${variant.sku} is used more than once`, variant.id);
      }
      if (product.pageType === '1B' && COLOUR_SUFFIX.test(variant.sku)) {
        add(
          'colour-in-sku',
          `SKU ${variant.sku} carries a colour code; use one PC SKU per size`,
          variant.id,
        );
      }
      if (codeInName(variant.title, skus)) {
        add(
          'code-in-name',
          `Take the product code out of the option name "${variant.title}"`,
          variant.id,
        );
      }
    }
    return problems;
  });
}
