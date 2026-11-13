import {
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { StaffOnly } from '../auth/staff.guard.js';
import { AcceptsQuery, Fails, Returns, ValidQuery } from '../common/contract.js';
import { catalogueRows } from './export/catalogue-export.js';
import { writeWorkbook } from './export/xlsx-writer.js';
import { CatalogueImporter } from './import/catalogue-import.js';
import { importReport } from './import/import-report.js';
import { MasterSheetError, MasterSheetPimSource } from './import/master-sheet.js';
import { summarise } from './import/pim-source.js';
import { WorkbookError } from './import/xlsx.js';
import { ProductRepository } from './product.repository.js';

const MAX_SHEET_BYTES = 20 * 1024 * 1024;
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const importQuerySchema = z.object({
  apply: z
    .enum(['true', 'false'])
    .default('false')
    .describe('false only reports what would change; true makes the changes'),
});

const importResultSchema = z.object({
  applied: z.boolean(),
  report: z.array(z.string()).describe('The same report the command-line import prints'),
});

@ApiTags('admin: catalogue')
@Controller('admin/catalogue')
@StaffOnly('catalogue')
export class CatalogueTransferController {
  constructor(
    private readonly importer: CatalogueImporter,
    private readonly products: ProductRepository,
  ) {}

  // The product master sheet, uploaded from the admin instead of copied onto the server.
  @Post('import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SHEET_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @AcceptsQuery(importQuerySchema)
  @Returns(importResultSchema)
  @Fails([422, 'Not the product master sheet'], [413, 'Bigger than 20 MB'])
  async import(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @ValidQuery(importQuerySchema) query: z.infer<typeof importQuerySchema>,
  ): Promise<z.infer<typeof importResultSchema>> {
    if (!file) throw new UnprocessableEntityException('Choose the product master sheet (.xlsx)');
    const source = new MasterSheetPimSource(file.buffer);
    try {
      const snapshot = await source.snapshot();
      const dryRun = query.apply !== 'true';
      const result = await this.importer.run(snapshot, { dryRun });
      return { applied: !dryRun, report: importReport(source.name, summarise(snapshot), result) };
    } catch (error) {
      if (error instanceof WorkbookError || error instanceof MasterSheetError)
        throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  @Get('export')
  @ApiProduces(XLSX)
  async export(@Res() response: Response) {
    const workbook = writeWorkbook('Catalogue', catalogueRows(await this.products.all()));
    const day = new Date().toISOString().slice(0, 10);
    response
      .type(XLSX)
      .set('content-disposition', `attachment; filename="talasey-catalogue-${day}.xlsx"`)
      .send(Buffer.from(workbook));
  }
}
