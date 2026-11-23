import { z } from 'zod';
import type { StoreProduct } from '../catalogue/catalogue.schemas.js';
import type { ToolDefinition } from './answer-model.js';
import type { ProductCard } from './assistant.schemas.js';
import {
  details,
  isForSale,
  priceLabel,
  productPath,
  quantities,
  search,
  stockLabel,
} from './product-facts.js';

const MAX_CARDS = 4;
const MAX_RESULTS = 8;
const DEFAULT_WASTE = 10;

const searchInput = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(MAX_RESULTS).optional(),
});
const handleInput = z.object({ handle: z.string().min(1).max(200) });
const quantityInput = handleInput.extend({
  area_m2: z.number().positive().max(10_000),
  waste_percent: z.number().min(0).max(30).optional(),
});
const teamInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email(),
  phone: z.string().trim().max(40).optional(),
  postcode: z.string().trim().max(12).optional(),
  message: z.string().trim().min(10).max(2500),
});
export type TeamRequest = z.infer<typeof teamInput>;
export type PassToTeam = (request: TeamRequest) => Promise<{ ok: boolean; problems?: string[] }>;

const gapInput = z.object({ missing: z.string().trim().min(3).max(300) });

const showInput = z.object({
  products: z
    .array(
      handleInput.extend({
        variant_id: z.string().optional(),
        quantity: z.number().int().min(1).max(999).optional(),
      }),
    )
    .min(1)
    .max(MAX_CARDS),
});

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_products',
    description:
      'Find products in the catalogue by words such as a material, colour, use or product name. Returns each match with its price (per m² for paving and decking), stock and options. Use it before recommending or quoting anything.',
    input_schema: z.toJSONSchema(searchInput) as Record<string, unknown>,
  },
  {
    name: 'product_details',
    description:
      'Everything about one product by its handle: description, every variant with its id, price, coverage per pack and stock, and whether it is sold online.',
    input_schema: z.toJSONSchema(handleInput) as Record<string, unknown>,
  },
  {
    name: 'work_out_quantity',
    description:
      'For a product sold by area (paving, decking, cladding), the packs needed to cover an area and what they cost, for each size. Adds 10% for cuts unless told otherwise. Always use this instead of doing the sums yourself.',
    input_schema: z.toJSONSchema(quantityInput) as Record<string, unknown>,
  },
  {
    name: 'show_products',
    description: `Show up to ${MAX_CARDS} products as cards under your reply, with a link and, when a single variant is chosen, an Add to bag button. Pass variant_id (from product_details) and quantity (for example the packs from work_out_quantity) when you know them. Call it whenever you recommend specific products.`,
    input_schema: z.toJSONSchema(showInput) as Record<string, unknown>,
  },
  {
    name: 'note_gap',
    description:
      "Quietly tell the website team when you couldn't answer properly because the information isn't in the site knowledge or the tools, such as a missing size, a policy or a product we might not sell. Say what was missing in a few words. The visitor doesn't see this; still answer them as well as you can.",
    input_schema: z.toJSONSchema(gapInput) as Record<string, unknown>,
  },
  {
    name: 'pass_to_team',
    description:
      "Send the visitor's question or quote request to the Talasey team, who reply by email or phone within working hours. Needs their name, email and a clear message summing up what they want (products, sizes, area, postcode for delivery). Photos they sent in the chat go with it. Only call it after reading the details back to them and getting a clear yes.",
    input_schema: z.toJSONSchema(teamInput) as Record<string, unknown>,
  },
];

function card(
  product: StoreProduct,
  variantId: string | undefined,
  quantity: number | undefined,
): ProductCard {
  const variant =
    product.variants.find((candidate) => candidate.id === variantId) ??
    (product.variants.length === 1 ? product.variants[0] : undefined);
  const canAdd =
    variant !== undefined &&
    product.sellOnline &&
    !product.madeToMeasure &&
    !product.colourChoice?.required &&
    isForSale(variant);
  const count = quantity ?? 1;
  return {
    handle: product.handle,
    title: product.title,
    href: productPath(product.handle),
    image: product.thumbnail ?? product.images[0]?.url ?? null,
    choice: variant && product.variants.length > 1 ? variant.title : null,
    price: priceLabel(product),
    stock: stockLabel(variant ? [variant] : product.variants),
    add: canAdd
      ? {
          variantId: variant.id,
          quantity: count,
          label: count > 1 ? `Add ${count} to bag` : 'Add to bag',
        }
      : null,
  };
}

// The tools the assistant can call during one reply. Cards it asks to show are kept for the reply.
export class AssistantTools {
  readonly cards: ProductCard[] = [];
  gap: string | null = null;
  handedOff = false;

  constructor(
    private readonly products: StoreProduct[],
    private readonly passToTeam: PassToTeam,
  ) {}

  async run(name: string, input: unknown): Promise<unknown> {
    switch (name) {
      case 'search_products': {
        const { query, limit } = searchInput.parse(input);
        const found = search(this.products, query, limit ?? MAX_RESULTS);
        return found.length > 0 ? found : { found: 'Nothing matched. Try fewer or simpler words.' };
      }
      case 'product_details': {
        const product = this.find(handleInput.parse(input).handle);
        return product ? details(product) : { error: 'No product with that handle' };
      }
      case 'work_out_quantity': {
        const { handle, area_m2, waste_percent } = quantityInput.parse(input);
        const product = this.find(handle);
        if (!product) return { error: 'No product with that handle' };
        const options = quantities(product, area_m2, waste_percent ?? DEFAULT_WASTE);
        return options.length > 0
          ? { areaM2: area_m2, allowanceForCutsPercent: waste_percent ?? DEFAULT_WASTE, options }
          : { error: 'This product is not sold by area, so there is nothing to work out' };
      }
      case 'show_products': {
        const shown = showInput.parse(input).products.flatMap((item) => {
          const product = this.find(item.handle);
          return product ? [card(product, item.variant_id, item.quantity)] : [];
        });
        this.cards.splice(0, this.cards.length, ...shown);
        return { shown: shown.map((entry) => entry.title) };
      }
      case 'note_gap': {
        this.gap = gapInput.parse(input).missing;
        return { noted: true };
      }
      case 'pass_to_team': {
        const result = await this.passToTeam(teamInput.parse(input));
        this.handedOff ||= result.ok;
        return result.ok
          ? { sent: true, next: 'The team will reply by email, usually within one working day.' }
          : { sent: false, problems: result.problems ?? ['It could not be sent just now'] };
      }
      default:
        return { error: `There is no tool called ${name}` };
    }
  }

  private find(handle: string): StoreProduct | undefined {
    return this.products.find((product) => product.handle === handle);
  }
}
