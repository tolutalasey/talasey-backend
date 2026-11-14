import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  priceBespoke,
  readBespokeConfig,
  type BespokeSelection,
} from '../catalogue/bespoke/pricing.js';
import { ColourSetRepository } from '../catalogue/colour-sets/colour-set.repository.js';
import type { CatalogueProduct } from '../catalogue/product.js';
import { ProductRepository } from '../catalogue/product.repository.js';
import { buildLines, type BuildPart } from '../catalogue/rules/build-lines.js';
import { colourProblem, type ColourRule } from '../catalogue/rules/colour-rules.js';
import {
  splitLines,
  splitStock,
  stockSettings,
  type LineStock,
} from '../catalogue/rules/stock-mode.js';
import type { Address, Basket } from './basket.js';
import { BasketRepository, type NewLine } from './basket.repository.js';

export type BasketChange =
  { ok: true; basket: Basket } | { ok: false; problem: string; status?: 404 };

const notFound: BasketChange = { ok: false, problem: 'Basket not found', status: 404 };
const problem = (message: string): BasketChange => ({ ok: false, problem: message });

export interface AddItem {
  variantId: string;
  quantity: number;
  colourId?: string;
}

@Injectable()
export class BasketService {
  constructor(
    private readonly baskets: BasketRepository,
    private readonly products: ProductRepository,
    private readonly colourSets: ColourSetRepository,
  ) {}

  async create(): Promise<Basket> {
    return (await this.baskets.find(await this.baskets.create())) as Basket;
  }

  find(id: string) {
    return this.baskets.find(id);
  }

  async addItem(basketId: string, item: AddItem): Promise<BasketChange> {
    return this.change(basketId, async (basket) => {
      const found = await this.sellable(item.variantId);
      if (typeof found === 'string') return found;
      const { product, variant } = found;
      if (product.pageType === '2') {
        return `Enter your measurements to add ${product.title} to your basket.`;
      }
      if (product.pageType === '3') {
        return `${product.title} is made to your brief. Send us an enquiry and we'll quote.`;
      }
      const colour = colourProblem(await this.colourRule(product), variant.options, {
        colour_id: item.colourId,
      });
      if (colour) return colour;

      const inBasket = basket.lines
        .filter((line) => line.variantId === variant.id)
        .reduce((total, line) => total + line.quantity, 0);
      const split = splitStock(product.stockMode, variant.stockQuantity, inBasket + item.quantity);
      if (!split.purchasable) {
        return `Only ${variant.stockQuantity} of ${variant.title} in stock.`;
      }
      return [{ variantId: variant.id, quantity: item.quantity, colourId: item.colourId ?? null }];
    });
  }

  // Made-to-measure: the server works out the price from the sizes and choices, whatever the
  // browser showed.
  async addBespoke(
    basketId: string,
    item: { variantId: string; quantity: number } & BespokeSelection,
  ): Promise<BasketChange> {
    return this.change(basketId, async () => {
      const found = await this.sellable(item.variantId, { allowUnpriced: true });
      if (typeof found === 'string') return found;
      const config = readBespokeConfig({ bespoke: found.product.bespoke });
      if (found.product.pageType !== '2' || !config) {
        return `${found.product.title} is not made to measure.`;
      }
      const priced = priceBespoke(config, item);
      if (!priced.ok) return priced.problems.join(' ');
      return [
        {
          variantId: item.variantId,
          quantity: item.quantity,
          unitPricePence: Math.round(priced.price * 100),
          bespoke: { unit: config.unit, dimensions: item.dimensions, choices: item.choices },
        },
      ];
    });
  }

  // A build is one line per SKU, kept together by its build id (page type 4).
  async addBuild(
    basketId: string,
    parts: BuildPart[],
  ): Promise<BasketChange & { buildId?: string }> {
    const buildId = `bld_${randomUUID()}`;
    const result = await this.change(basketId, async () => {
      for (const part of parts) {
        const found = await this.sellable(part.variant_id);
        if (typeof found === 'string') return found;
      }
      return buildLines(buildId, parts).map((line) => ({
        variantId: line.variant_id,
        quantity: line.quantity,
        buildId,
        buildParts: line.metadata.build_parts,
      }));
    });
    return result.ok ? { ...result, buildId } : result;
  }

  async setQuantity(basketId: string, lineId: string, quantity: number): Promise<BasketChange> {
    const basket = await this.baskets.find(basketId);
    if (!basket) return notFound;
    if (basket.orderId) return problem('This basket has already been ordered.');
    if (!(await this.baskets.setQuantity(basketId, lineId, quantity))) return notFound;
    return { ok: true, basket: (await this.baskets.find(basketId)) as Basket };
  }

  async setContact(basketId: string, email: string, address: Address): Promise<BasketChange> {
    const basket = await this.baskets.find(basketId);
    if (!basket) return notFound;
    await this.baskets.update(basketId, { email, address });
    return { ok: true, basket: (await this.baskets.find(basketId)) as Basket };
  }

  async setPromotionCode(basketId: string, code: string | null): Promise<BasketChange> {
    const basket = await this.baskets.find(basketId);
    if (!basket) return notFound;
    await this.baskets.update(basketId, { promotionCode: code });
    return { ok: true, basket: (await this.baskets.find(basketId)) as Basket };
  }

  // How much of each line ships now and how much is made to order. Lines for the same SKU share
  // its stock, first line first.
  stock(basket: Basket): LineStock[] {
    return splitLines(
      basket.lines.map((line) => ({
        id: line.id,
        variant_id: line.variantId,
        quantity: line.quantity,
        ...stockSettings(line.stockMode),
      })),
      Object.fromEntries(basket.lines.map((line) => [line.variantId, line.stockQuantity])),
    );
  }

  private async change(
    basketId: string,
    lines: (basket: Basket) => Promise<NewLine[] | string>,
  ): Promise<BasketChange> {
    const basket = await this.baskets.find(basketId);
    if (!basket) return notFound;
    if (basket.orderId) return problem('This basket has already been ordered.');
    const result = await lines(basket);
    if (typeof result === 'string') return problem(result);
    for (const line of result) await this.baskets.addLine(basketId, line);
    return { ok: true, basket: (await this.baskets.find(basketId)) as Basket };
  }

  private async sellable(variantId: string, { allowUnpriced = false } = {}) {
    const ids = await this.products.idsForVariants([variantId]);
    const product = ids[0] ? await this.products.find({ id: ids[0] }) : null;
    const variant = product?.variants.find((candidate) => candidate.id === variantId);
    if (!product?.published || !variant) return 'That product is no longer available.';
    if (variant.pricePence === null && !allowUnpriced) {
      return `${product.title} isn't for sale online yet. Call us for a price.`;
    }
    return { product, variant };
  }

  private async colourRule(product: CatalogueProduct): Promise<ColourRule | null> {
    if (!product.colourSetId) return null;
    const set = await this.colourSets.find(product.colourSetId);
    if (!set) return null;
    return {
      option: product.colourOption,
      value: product.colourOptionValue,
      required: product.colourRequired,
      colours: set.colours.map(({ id, name, hex, photoUrl }) => ({
        id,
        name,
        hex,
        photo_url: photoUrl,
      })),
    };
  }
}
