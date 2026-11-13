import 'reflect-metadata';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { JobQueue } from '../../jobs/job-queue.js';
import { CatalogueImporter } from './catalogue-import.js';
import { importReport } from './import-report.js';
import { MasterSheetPimSource } from './master-sheet.js';
import { summarise } from './pim-source.js';

// pnpm catalogue:import [--dry-run] [path to the master sheet]
const DEFAULT_SHEET = '.data/pim/Talasey_Product_Master_Sheet_filled.xlsx';
const DRY_RUN = '--dry-run';

const args = process.argv.slice(2);
const dryRun = args.includes(DRY_RUN);
const sheet = args.find((arg) => arg !== DRY_RUN) ?? process.env.PIM_SHEET ?? DEFAULT_SHEET;

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
try {
  const source = new MasterSheetPimSource(resolve(sheet));
  const snapshot = await source.snapshot();
  const result = await app.get(CatalogueImporter).run(snapshot, { dryRun });
  const report = importReport(source.name, summarise(snapshot), result);
  process.stdout.write(`${report.join('\n')}\n`);
  await app.get(JobQueue).drain();
} finally {
  await app.close();
}
