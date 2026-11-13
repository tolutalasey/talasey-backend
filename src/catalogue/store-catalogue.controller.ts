import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { bespokeQuoteSchema } from '../basket/basket.schemas.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import {
  colourOfferSchema,
  storeProductSchema,
  type ColourOfferDto,
  type StoreProduct,
} from './catalogue.schemas.js';
import { StoreCatalogueService } from './store-catalogue.service.js';

const handleSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

@ApiTags('store: catalogue')
@Controller('store/products')
export class StoreCatalogueController {
  constructor(private readonly catalogue: StoreCatalogueService) {}

  @Get()
  @Returns(z.array(storeProductSchema))
  list(): Promise<StoreProduct[]> {
    return this.catalogue.published();
  }

  @Get(':handle')
  @Returns(storeProductSchema)
  @Fails([404, 'No published product with that handle'])
  async byHandle(@ValidParam('handle', handleSchema) handle: string): Promise<StoreProduct> {
    const product = await this.catalogue.byHandle(handle);
    if (!product) throw new NotFoundException('No such product');
    return product;
  }

  @Get(':id/colours')
  @ApiQuery({
    name: 'selected',
    required: false,
    style: 'deepObject',
    explode: true,
    schema: { type: 'object', additionalProperties: { type: 'string' } },
    description: 'The options picked so far, e.g. selected[Finish]=Powder Coated',
  })
  @Returns(colourOfferSchema, 200, 'The colours to offer, or null when there is no choice')
  @Fails([404, 'No published product with that id'])
  async colours(
    @ValidParam('id', z.uuid()) id: string,
    @Query('selected') selected: unknown,
  ): Promise<ColourOfferDto> {
    const parsed = z
      .record(z.string(), z.string())
      .catch({})
      .parse(selected ?? {});
    const offer = await this.catalogue.colours(id, parsed);
    if (offer === undefined) throw new NotFoundException('No such product');
    return offer;
  }

  @Post(':handle/bespoke-quote')
  @HttpCode(200)
  @Accepts(bespokeQuoteSchema)
  @Returns(z.object({ pricePence: z.number().int() }))
  @Fails(
    [404, 'Not a made-to-measure product'],
    [422, 'A size or choice is missing or out of range'],
  )
  async quote(
    @ValidParam('handle', handleSchema) handle: string,
    @ValidBody(bespokeQuoteSchema) body: z.infer<typeof bespokeQuoteSchema>,
  ): Promise<{ pricePence: number }> {
    const result = await this.catalogue.quoteBespoke(handle, body);
    if (!result) throw new NotFoundException('That product is not made to measure');
    if (!result.ok) throw new UnprocessableEntityException(result.problems);
    return { pricePence: result.pricePence };
  }
}
