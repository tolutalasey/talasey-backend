import { readFile } from 'node:fs/promises';
import type {
  CatalogueSnapshot,
  HeldBackItem,
  PimColourSet,
  PimProduct,
  PimSource,
  PimVariant,
} from './pim-source.js';
import { readWorkbook, records, type Row } from './xlsx.js';

type SheetRow = Record<string, string | null>;

const PRODUCTS = 'Products';
const NOT_IMPORTED = 'Not imported';
const FORMULAS_AND_COLOURS = 'Formulas & colours';
const COLOUR_SET_KEY = /^[a-z0-9_]+$/;
const META_PREFIX = 'Meta: wcpt_';
const MAX_ATTRIBUTES = 3;

export class MasterSheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MasterSheetError';
  }
}

export function handleFor(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/×/g, 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function money(value: string | null): number | null {
  if (value === null) return null;
  const amount = Number(value.replace(/[£,\s]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function number(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function attributes(row: SheetRow) {
  const found: { name: string; values: string[] }[] = [];
  for (let index = 1; index <= MAX_ATTRIBUTES; index++) {
    const name = row[`Attribute ${index} name`];
    const values = row[`Attribute ${index} value(s)`];
    if (name && values)
      found.push({ name, values: values.split(',').map((value) => value.trim()) });
  }
  return found;
}

function pimAttributes(row: SheetRow): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).flatMap(([column, value]) =>
      column.startsWith(META_PREFIX) && value ? [[column.slice(META_PREFIX.length), value]] : [],
    ),
  );
}

function required(row: SheetRow, column: string): string {
  const value = row[column];
  if (!value) {
    throw new MasterSheetError(`A row in ${PRODUCTS} (SKU ${row.SKU ?? 'none'}) has no ${column}.`);
  }
  return value;
}

function productFrom(row: SheetRow, variants: PimVariant[]): PimProduct {
  const name = required(row, 'Name');
  return {
    sku: required(row, 'SKU'),
    handle: handleFor(name),
    title: name,
    subtitle: row['Short description'] ?? null,
    description: row.Description ?? null,
    published: row.Published === '1',
    categoryPath: (row.Categories ?? '')
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean),
    options: attributes(row).map(({ name: title, values }) => ({ title, values })),
    variants,
    attributes: pimAttributes(row),
  };
}

function variantFrom(row: SheetRow, title: string, options: Record<string, string>): PimVariant {
  return {
    sku: required(row, 'SKU'),
    title,
    options,
    priceIncVat: money(row['Sale price'] ?? row['Regular price'] ?? null),
    weightKg: number(row['Weight (kg)'] ?? null),
  };
}

// A row is either two cells (key, list) or one cell written as key,"list".
function keyAndList(row: Row): [string, string] | null {
  const cells = row.filter((cell): cell is string => Boolean(cell?.trim()));
  if (cells.length >= 2) return [cells[0] ?? '', cells[1] ?? ''];
  const [only] = cells;
  const comma = only?.indexOf(',') ?? -1;
  if (!only || comma < 0) return null;
  return [only.slice(0, comma), only.slice(comma + 1).replace(/^"|"$/g, '')];
}

// The "Colour sets" block of the Formulas & colours tab: one set per row, colours as
// "Anthracite grey (RAL 7016), Jet black (RAL 9005)".
export function colourSetsFrom(rows: Row[]): PimColourSet[] {
  const start = rows.findIndex((row) => row[0]?.trim() === 'Colour sets');
  if (start < 0) return [];
  const sets: PimColourSet[] = [];
  for (const row of rows.slice(start + 1)) {
    if (row.every((cell) => !cell?.trim())) continue;
    const pair = keyAndList(row);
    if (!pair || !COLOUR_SET_KEY.test(pair[0].trim())) break;
    sets.push({
      key: pair[0].trim(),
      colours: pair[1]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const match = /^(.*?)\s*\(([^)]+)\)$/.exec(entry);
          return match
            ? { name: match[1] ?? entry, code: match[2] ?? null }
            : { name: entry, code: null };
        }),
    });
  }
  return sets;
}

export function toSnapshot(
  productRows: SheetRow[],
  notImportedRows: SheetRow[],
  colourSets: PimColourSet[] = [],
): CatalogueSnapshot {
  const variationsByParent = new Map<string, SheetRow[]>();
  for (const row of productRows.filter((row) => row.Type === 'variation')) {
    const parent = required(row, 'Parent');
    variationsByParent.set(parent, [...(variationsByParent.get(parent) ?? []), row]);
  }

  const products = productRows.flatMap((row): PimProduct[] => {
    switch (row.Type) {
      case 'simple':
        return [productFrom(row, [variantFrom(row, required(row, 'Name'), {})])];
      case 'variable': {
        const variations = variationsByParent.get(required(row, 'SKU')) ?? [];
        variationsByParent.delete(required(row, 'SKU'));
        const variants = variations.map((variation) => {
          const options = Object.fromEntries(
            attributes(variation).map(({ name, values }) => [name, values.join(', ')]),
          );
          return variantFrom(variation, Object.values(options).join(' / '), options);
        });
        return [productFrom(row, variants)];
      }
      case 'variation':
        return [];
      default:
        throw new MasterSheetError(`Unknown product type "${row.Type}" for SKU ${row.SKU}.`);
    }
  });

  const handles = new Set<string>();
  for (const product of products) {
    if (handles.has(product.handle)) product.handle = handleFor(`${product.handle} ${product.sku}`);
    handles.add(product.handle);
  }

  const orphans = [...variationsByParent.keys()];
  if (orphans.length > 0) {
    throw new MasterSheetError(
      `Options point at parents that are not in the sheet: ${orphans.join(', ')}.`,
    );
  }

  const heldBack = notImportedRows.map((row): HeldBackItem => ({
    name: row['Product name (product enrichment sheet)'] ?? '',
    sku: row.SKU ?? null,
    range: row.Range ?? null,
    reason: row["Why it isn't in the Products tab"] ?? 'No reason given',
  }));

  return { products, heldBack, colourSets };
}

export class MasterSheetPimSource implements PimSource {
  readonly name = 'Product master sheet';

  // A path on disk (the command line) or the bytes of an uploaded file (the admin).
  constructor(private readonly source: string | Buffer) {}

  async snapshot(): Promise<CatalogueSnapshot> {
    const bytes = typeof this.source === 'string' ? await readFile(this.source) : this.source;
    const workbook = readWorkbook(bytes);
    const notImported = workbook.sheetNames.includes(NOT_IMPORTED)
      ? records(workbook.rows(NOT_IMPORTED))
      : [];
    const colourSets = workbook.sheetNames.includes(FORMULAS_AND_COLOURS)
      ? colourSetsFrom(workbook.rows(FORMULAS_AND_COLOURS))
      : [];
    return toSnapshot(records(workbook.rows(PRODUCTS)), notImported, colourSets);
  }
}
