import { Inject, Injectable } from '@nestjs/common';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import { PUBLISHED_PRODUCTS_KEY } from './catalogue-changes.service.js';
import type { ColourOfferDto, StoreProduct } from './catalogue.schemas.js';
import { ColourSetRepository } from './colour-sets/colour-set.repository.js';
import type { CatalogueProduct } from './product.js';
import { ProductRepository } from './product.repository.js';
import { priceBespoke, readBespokeConfig, type BespokeSelection } from './bespoke/pricing.js';
import { coloursFor } from './rules/colour-rules.js';

const CACHE_SECONDS = 300;

const MEASUREMENT_ORDER = ['W', 'D', 'H', 'L'];

// The fields a made-to-measure product asks for, without the formula or the prices behind it.
function measurementsOf(bespoke: unknown): StoreProduct['measurements'] {
  const config = readBespokeConfig({ bespoke });
  if (!config) return null;
  return {
    unit: config.unit,
    dimensions: Object.entries(config.dimensions)
      .flatMap(([key, limits]) => (limits ? [{ key, ...limits }] : []))
      .sort((a, b) => MEASUREMENT_ORDER.indexOf(a.key) - MEASUREMENT_ORDER.indexOf(b.key)),
    choices: config.choices.map(({ name, label, answers }) => ({
      name,
      label,
      answers: answers.map((answer) => answer.label),
    })),
  };
}

export function toStoreProduct(product: CatalogueProduct): StoreProduct {
  const managed = product.stockMode !== 'made_to_order';
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    subtitle: product.subtitle,
    brand: product.brand,
    description: product.description,
    thumbnail: product.images[0]?.url ?? null,
    images: product.images,
    pageType: product.pageType,
    madeToMeasure: product.pageType === '2' && Boolean(product.bespoke),
    sellOnline: product.sellOnline,
    position: product.position,
    offlineAction: product.offlineAction,
    measurements: product.pageType === '2' ? measurementsOf(product.bespoke) : null,
    leadTime:
      product.leadTimeMinDays !== null && product.leadTimeMaxDays !== null
        ? { minDays: product.leadTimeMinDays, maxDays: product.leadTimeMaxDays }
        : null,
    updatedAt: product.updatedAt.toISOString(),
    categories: product.category ? [product.category] : [],
    options: product.options,
    colourChoice: product.colourSetId
      ? {
          label: product.colourLabel ?? 'Colour',
          option: product.colourOption,
          value: product.colourOptionValue,
          required: product.colourRequired,
        }
      : null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      options: variant.options,
      pricePence: variant.pricePence,
      stock: {
        managed,
        quantity: managed ? variant.stockQuantity : null,
        backorder: product.stockMode === 'stocked_then_made_to_order',
      },
      coverageM2: variant.coverageM2,
      weightKg: variant.weightKg,
    })),
  };
}

// What shoppers see: published products only, served from a Redis copy that any catalogue
// change clears.
@Injectable()
export class StoreCatalogueService {
  constructor(
    private readonly products: ProductRepository,
    private readonly colourSets: ColourSetRepository,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
  ) {}

  async published(): Promise<StoreProduct[]> {
    const cached = await this.store.get(PUBLISHED_PRODUCTS_KEY);
    if (cached) return JSON.parse(cached) as StoreProduct[];
    const products = (await this.products.published()).map(toStoreProduct);
    await this.store.set(PUBLISHED_PRODUCTS_KEY, JSON.stringify(products), CACHE_SECONDS);
    return products;
  }

  async byHandle(handle: string): Promise<StoreProduct | null> {
    return (await this.published()).find((product) => product.handle === handle) ?? null;
  }

  // The colours to offer once the shopper has picked options, e.g. { Finish: 'Powder Coated' }.
  async colours(
    productId: string,
    selected: Record<string, string>,
  ): Promise<ColourOfferDto | undefined> {
    const product = await this.products.find({ id: productId });
    if (!product?.published) return undefined;
    if (!product.colourSetId) return null;
    const set = await this.colourSets.find(product.colourSetId);
    const offer = coloursFor(
      set && {
        option: product.colourOption,
        value: product.colourOptionValue,
        required: product.colourRequired,
        colours: set.colours.map((colour) => ({ ...colour, photo_url: colour.photoUrl })),
      },
      selected,
    );
    return offer
      ? {
          required: offer.required,
          colours: offer.colours.map(({ id, name, hex, photo_url }) => ({
            id,
            name,
            hex,
            photoUrl: photo_url,
          })),
        }
      : null;
  }

  // The price for the sizes and choices, worked out the same way as when it goes in the basket.
  async quoteBespoke(
    handle: string,
    selection: BespokeSelection,
  ): Promise<{ ok: true; pricePence: number } | { ok: false; problems: string[] } | null> {
    const product = await this.products.find({ handle });
    const config = product?.published ? readBespokeConfig({ bespoke: product.bespoke }) : null;
    if (!config) return null;
    const result = priceBespoke(config, selection);
    return result.ok ? { ok: true, pricePence: Math.round(result.price * 100) } : result;
  }
}
