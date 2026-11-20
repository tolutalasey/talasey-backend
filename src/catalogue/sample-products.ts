import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { products } from '../database/schema/index.js';
import { linea, sienna } from './bespoke/planters.js';
import { priceBespoke } from './bespoke/pricing.js';
import type { ProductState, VariantState } from './product.js';
import { ProductRepository } from './product.repository.js';

export const PRODUCT_HANDLE = 'pavetuf-jointing-compound';
export const STOCKED_HANDLE = 'silver-grey-porcelain-paving';
export const BESPOKE_HANDLE = 'sienna-planter';
export const LINEA_HANDLE = 'linea-planter';
export const SPACERS_HANDLE = 'porcelain-tile-spacers';

const smallest = { FIN: 'Mild steel', FEET: 'No', CASTORS: 'No', DRAIN: 'No' };
const fromPrice = (result: ReturnType<typeof priceBespoke>) =>
  result.ok ? Math.round(result.price * 100) : null;

const base = {
  subtitle: null,
  brand: null,
  published: true,
  leadTimeMinDays: null,
  leadTimeMaxDays: null,
  categoryId: null,
  colourSetId: null,
  colourOption: null,
  colourOptionValue: null,
  colourRequired: true,
  colourLabel: null,
  sellOnline: true,
  offlineAction: 'stockist',
  bespoke: null,
  attributes: {},
  pimSku: null,
  images: [],
  colourImages: [],
} satisfies Partial<ProductState>;

const variant = (fields: Partial<VariantState> & Pick<VariantState, 'sku' | 'title'>) => ({
  id: randomUUID(),
  options: {},
  pricePence: null,
  weightKg: null,
  coverageM2: null,
  stockQuantity: 0,
  barcode: null,
  ...fields,
});

// Demo products the tests and the demo rely on, alongside the imported catalogue.
export function sampleProducts(): ProductState[] {
  return [
    {
      ...base,
      handle: PRODUCT_HANDLE,
      title: 'Pavetuf jointing compound',
      brand: 'Pavetuf',
      description:
        'Brush-in jointing compound for porcelain and natural stone patios. Sets in all weathers and resists weeds and jet washing.',
      pageType: '1A',
      stockMode: 'made_to_order',
      leadTimeMinDays: 2,
      leadTimeMaxDays: 4,
      options: [{ title: 'Colour', values: ['Grey', 'Buff'] }],
      variants: [
        variant({
          sku: 'PVT-GRY-15',
          title: 'Grey',
          options: { Colour: 'Grey' },
          weightKg: 15,
          pricePence: 3999,
        }),
        variant({
          sku: 'PVT-BUF-15',
          title: 'Buff',
          options: { Colour: 'Buff' },
          weightKg: 15,
          pricePence: 4250,
        }),
      ],
    },
    {
      ...base,
      handle: STOCKED_HANDLE,
      title: 'Silver grey porcelain paving',
      description:
        '20 mm outdoor porcelain in 600 × 600 mm slabs, sold by the pack of four (1.44 m²). We send what is in the yard straight away and make the rest to order.',
      pageType: '1A',
      stockMode: 'stocked_then_made_to_order',
      leadTimeMinDays: 10,
      leadTimeMaxDays: 15,
      options: [{ title: 'Size', values: ['600 × 600 mm'] }],
      variants: [
        variant({
          sku: 'POR-SLV-600',
          title: '600 × 600 mm, pack of 4',
          options: { Size: '600 × 600 mm' },
          weightKg: 70,
          coverageM2: 1.44,
          pricePence: 8999,
          stockQuantity: 12,
        }),
      ],
    },
    {
      ...base,
      handle: SPACERS_HANDLE,
      title: 'Porcelain tile spacers',
      description: '3 mm cross spacers for even joints between porcelain slabs. Bag of 250.',
      pageType: '1A',
      stockMode: 'stocked',
      options: [],
      variants: [
        variant({
          sku: 'SPACER-3MM-250',
          title: 'Bag of 250',
          weightKg: 0.5,
          pricePence: 699,
          stockQuantity: 40,
        }),
      ],
    },
    {
      ...base,
      handle: BESPOKE_HANDLE,
      title: 'Sienna planter',
      description:
        'Steel planter made to your measurements in mild steel, corten or powder-coated steel.',
      pageType: '2',
      stockMode: 'made_to_order',
      leadTimeMinDays: 15,
      leadTimeMaxDays: 20,
      bespoke: sienna,
      options: [],
      variants: [
        variant({
          sku: 'SIENNA-BESPOKE',
          title: 'Made to measure',
          weightKg: 60,
          pricePence: fromPrice(
            priceBespoke(sienna, { dimensions: { W: 400, H: 300, D: 300 }, choices: smallest }),
          ),
        }),
      ],
    },
    {
      ...base,
      handle: LINEA_HANDLE,
      title: 'Linea planter',
      description: 'L-shaped steel planter made to your measurements, for corners and borders.',
      pageType: '2',
      stockMode: 'made_to_order',
      leadTimeMinDays: 15,
      leadTimeMaxDays: 20,
      bespoke: linea,
      options: [],
      variants: [
        variant({
          sku: 'LINEA-BESPOKE',
          title: 'Made to measure',
          weightKg: 80,
          pricePence: fromPrice(
            priceBespoke(linea, {
              dimensions: { W: 600, D: 300, H: 300, L: 600 },
              choices: smallest,
            }),
          ),
        }),
      ],
    },
  ];
}

export async function seedSampleProducts(db: Database) {
  const repository = new ProductRepository(db);
  for (const product of sampleProducts()) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.handle, product.handle));
    if (!existing) await repository.save(db, randomUUID(), product);
  }
}
