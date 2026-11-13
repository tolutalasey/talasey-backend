import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentStaff, StaffOnly } from '../auth/staff.guard.js';
import type { StaffUser } from '../auth/staff-user.repository.js';
import {
  Accepts,
  AcceptsQuery,
  Fails,
  Returns,
  ValidBody,
  ValidParam,
  ValidQuery,
} from '../common/contract.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { categories } from '../database/schema/index.js';
import {
  adminProductSchema,
  bespokeTrialResultSchema,
  bespokeTrialSchema,
  categorySchema,
  newProductSchema,
  productInputSchema,
  productSearchSchema,
  productSummarySchema,
  skuProblemSchema,
  type AdminProduct,
  type NewProduct,
  type ProductInput,
} from './catalogue.schemas.js';
import { checkBespokeConfig, priceBespoke } from './bespoke/pricing.js';
import type { CatalogueProduct } from './product.js';
import { ProductAdminService, type ProductResult } from './product-admin.service.js';

function toAdminProduct(product: CatalogueProduct, problems: string[]): AdminProduct {
  const { category: _category, updatedAt, ...state } = product;
  return { ...state, updatedAt: updatedAt.toISOString(), problems };
}

function savedOrThrow(result: ProductResult): CatalogueProduct {
  switch (result.status) {
    case 'saved':
      return result.product;
    case 'not-found':
      throw new NotFoundException('No such product');
    case 'invalid':
      throw new UnprocessableEntityException(result.problems);
  }
}

@ApiTags('admin: catalogue')
@Controller('admin')
@StaffOnly('catalogue')
export class ProductAdminController {
  constructor(
    private readonly products: ProductAdminService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Get('products')
  @AcceptsQuery(productSearchSchema)
  @Returns(z.array(productSummarySchema))
  async list(@ValidQuery(productSearchSchema) query: z.infer<typeof productSearchSchema>) {
    const products = await this.products.list(query.search);
    return products.map((product) => ({ ...product, updatedAt: product.updatedAt.toISOString() }));
  }

  @Post('products')
  @Accepts(newProductSchema)
  @Returns(adminProductSchema, 201)
  @Fails([422, 'The web address is taken'])
  async create(
    @ValidBody(newProductSchema) body: NewProduct,
    @CurrentStaff() actor: StaffUser,
  ): Promise<AdminProduct> {
    return toAdminProduct(savedOrThrow(await this.products.create(body, actor)), []);
  }

  @Get('products/:id')
  @Returns(adminProductSchema)
  @Fails([404, 'No such product'])
  async find(@ValidParam('id', z.uuid()) id: string): Promise<AdminProduct> {
    const found = await this.products.find(id);
    if (!found) throw new NotFoundException('No such product');
    return toAdminProduct(
      found.product,
      found.problems.map((problem) => problem.message),
    );
  }

  @Put('products/:id')
  @Accepts(productInputSchema)
  @Returns(adminProductSchema)
  @Fails([404, 'No such product'], [422, 'Something needs fixing before it can be saved'])
  async update(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(productInputSchema) body: ProductInput,
    @CurrentStaff() actor: StaffUser,
  ): Promise<AdminProduct> {
    const product = savedOrThrow(await this.products.update(id, body, actor));
    const found = await this.products.find(product.id);
    return toAdminProduct(product, found?.problems.map((problem) => problem.message) ?? []);
  }

  @Delete('products/:id')
  @HttpCode(204)
  @Fails([404, 'No such product'])
  async remove(@ValidParam('id', z.uuid()) id: string, @CurrentStaff() actor: StaffUser) {
    if (!(await this.products.remove(id, actor))) throw new NotFoundException('No such product');
  }

  // The test calculator in the admin: a price for any size and choices, from a set-up that may
  // not be saved yet, worked out exactly as the shop and the basket do.
  @Post('catalogue/bespoke/price')
  @HttpCode(200)
  @Accepts(bespokeTrialSchema)
  @Returns(bespokeTrialResultSchema)
  tryBespoke(
    @ValidBody(bespokeTrialSchema) body: z.infer<typeof bespokeTrialSchema>,
  ): z.infer<typeof bespokeTrialResultSchema> {
    const check = checkBespokeConfig(body.config);
    if (!check.ok) return check;
    const result = priceBespoke(check.config, {
      dimensions: body.dimensions,
      choices: body.choices,
    });
    return result.ok ? { ok: true, pricePence: Math.round(result.price * 100) } : result;
  }

  @Get('catalogue/sku-checks')
  @Returns(z.array(skuProblemSchema))
  skuChecks() {
    return this.products.skuProblems();
  }

  @Get('categories')
  @Returns(z.array(categorySchema))
  categories() {
    return this.db
      .select({
        id: categories.id,
        handle: categories.handle,
        name: categories.name,
        parentId: categories.parentId,
      })
      .from(categories)
      .orderBy(asc(categories.handle));
  }
}
