export type StockMode = 'stocked' | 'made_to_order' | 'stocked_then_made_to_order';

export interface StockSettings {
  manage_inventory: boolean;
  allow_backorder: boolean;
}

export interface StockSplit {
  mode: StockMode;
  now: number;
  made_to_order: number;
  purchasable: boolean;
}

export function stockMode({ manage_inventory, allow_backorder }: StockSettings): StockMode {
  if (!manage_inventory) return 'made_to_order';
  return allow_backorder ? 'stocked_then_made_to_order' : 'stocked';
}

export const STOCK_MODES = ['stocked', 'made_to_order', 'stocked_then_made_to_order'] as const;

export const STOCK_MODE_LABELS: Record<StockMode, string> = {
  stocked: 'stocked only',
  made_to_order: 'made to order',
  stocked_then_made_to_order: 'stocked, then made to order',
};

export function stockSettings(mode: StockMode): StockSettings {
  return {
    manage_inventory: mode !== 'made_to_order',
    allow_backorder: mode === 'stocked_then_made_to_order',
  };
}

export function splitStock(
  mode: StockMode,
  available: number | null,
  quantity: number,
): StockSplit {
  const inStock = Math.max(available ?? 0, 0);
  switch (mode) {
    case 'stocked':
      return {
        mode,
        now: Math.min(quantity, inStock),
        made_to_order: 0,
        purchasable: quantity <= inStock,
      };
    case 'made_to_order':
      return { mode, now: 0, made_to_order: quantity, purchasable: true };
    case 'stocked_then_made_to_order': {
      const now = Math.min(quantity, inStock);
      return { mode, now, made_to_order: quantity - now, purchasable: true };
    }
  }
}

export function describeSplit({ now, made_to_order }: StockSplit): string {
  if (made_to_order === 0) return `${now} in stock`;
  if (now === 0) return `${made_to_order} made to order`;
  return `${now} now, ${made_to_order} made to order`;
}

export interface StockLine extends StockSettings {
  id: string;
  variant_id: string;
  quantity: number;
}

export interface LineStock extends StockSplit {
  line_id: string;
  label: string;
}

// Lines for the same SKU share its stock, first line first.
export function splitLines(
  lines: StockLine[],
  available: Record<string, number | null>,
): LineStock[] {
  const remaining = new Map(Object.entries(available));
  return lines.map((line) => {
    const split = splitStock(
      stockMode(line),
      remaining.get(line.variant_id) ?? null,
      line.quantity,
    );
    remaining.set(line.variant_id, Math.max((remaining.get(line.variant_id) ?? 0) - split.now, 0));
    return { line_id: line.id, ...split, label: describeSplit(split) };
  });
}
