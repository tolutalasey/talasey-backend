import type { ImportResult } from './catalogue-import.js';
import type { CatalogueSummary } from './pim-source.js';

export function importReport(source: string, summary: CatalogueSummary, result: ImportResult) {
  const verb = result.dryRun ? 'Would' : 'Did';
  const lines = [
    `${source}: ${summary.rows} rows, ${summary.products} products ` +
      `(${summary.withVariants} with options, ${summary.single} single), ${summary.skus} SKUs, ` +
      `${summary.heldBack} held back, ${summary.unpriced} without a price.`,
    ...Object.entries(summary.heldBackReasons).map(
      ([reason, count]) => `Held back (${count}): ${reason}`,
    ),
    `${verb} create ${result.created} products and ${result.categoriesCreated} categories, ` +
      `update ${result.updated}; ${result.unchanged} unchanged.`,
    `${verb} create ${result.colourSetsCreated} colour sets, add ${result.coloursAdded} colours ` +
      `and give ${result.profilesCreated} products a colour set (page type 1B).`,
    ...result.skipped.map(({ sku, handle, reason }) => `Skipped ${sku} on ${handle}: ${reason}`),
  ];
  if (result.dryRun) lines.push('Dry run: nothing was changed.');
  return lines;
}
