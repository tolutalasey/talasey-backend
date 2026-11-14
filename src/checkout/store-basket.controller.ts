import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  NotFoundException,
  Patch,
  Post,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Basket } from '../basket/basket.js';
import {
  accessAnswersSchema,
  addLineSchema,
  basketSchema,
  bespokeItemSchema,
  buildSchema,
  completeSchema,
  contactSchema,
  deliveryChoiceSchema,
  deliveryDayOptionSchema,
  deliveryDaySchema,
  deliveryOptionSchema,
  paymentStartSchema,
  placedSchema,
  quantitySchema,
  type BasketDto,
} from '../basket/basket.schemas.js';
import { BasketService, type BasketChange } from '../basket/basket.service.js';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import { BasketViewService } from './basket-view.service.js';
import { CheckoutService } from './checkout.service.js';
import { DeliveryCheckoutService, type DeliveryResult } from './delivery-checkout.service.js';

const id = z.uuid();
const promotionCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a code')
    .max(40)
    .transform((code) => code.toUpperCase()),
});

function fail(problem: string, status: number): never {
  if (status === 404) throw new NotFoundException(problem);
  if (status === 409) throw new ConflictException(problem);
  if (status === 400) throw new UnprocessableEntityException(problem);
  throw new HttpException(problem, status);
}

@ApiTags('store: basket and checkout')
@Controller('store/baskets')
export class StoreBasketController {
  constructor(
    private readonly baskets: BasketService,
    private readonly views: BasketViewService,
    private readonly delivery: DeliveryCheckoutService,
    private readonly checkout: CheckoutService,
  ) {}

  @Post()
  @Returns(basketSchema, 201)
  async create(): Promise<BasketDto> {
    return this.views.view(await this.baskets.create());
  }

  @Get(':id')
  @Returns(basketSchema)
  @Fails([404, 'No such basket'])
  async find(@ValidParam('id', id) basketId: string): Promise<BasketDto> {
    return this.views.view(await this.basket(basketId));
  }

  @Post(':id/lines')
  @Accepts(addLineSchema)
  @Returns(basketSchema, 201)
  @Fails([404, 'No such basket'], [422, 'Not for sale, needs a colour, or out of stock'])
  async addLine(
    @ValidParam('id', id) basketId: string,
    @ValidBody(addLineSchema) body: z.infer<typeof addLineSchema>,
  ): Promise<BasketDto> {
    return this.changed(await this.baskets.addItem(basketId, body));
  }

  @Post(':id/bespoke-items')
  @Accepts(bespokeItemSchema)
  @Returns(basketSchema, 201)
  @Fails([422, 'A measurement or choice is missing or out of range'])
  async addBespoke(
    @ValidParam('id', id) basketId: string,
    @ValidBody(bespokeItemSchema) body: z.infer<typeof bespokeItemSchema>,
  ): Promise<BasketDto> {
    return this.changed(await this.baskets.addBespoke(basketId, body));
  }

  @Post(':id/builds')
  @Accepts(buildSchema)
  @Returns(basketSchema.extend({ buildId: z.string() }), 201)
  async addBuild(
    @ValidParam('id', id) basketId: string,
    @ValidBody(buildSchema) body: z.infer<typeof buildSchema>,
  ): Promise<BasketDto & { buildId: string }> {
    const result = await this.baskets.addBuild(
      basketId,
      body.parts.map((part) => ({
        variant_id: part.variantId,
        quantity: part.quantity,
        side: part.side,
      })),
    );
    const view = await this.changed(result);
    return { ...view, buildId: result.buildId ?? '' };
  }

  @Patch(':id/lines/:lineId')
  @Accepts(quantitySchema)
  @Returns(basketSchema)
  @Fails([404, 'No such basket or line'])
  async setQuantity(
    @ValidParam('id', id) basketId: string,
    @ValidParam('lineId', id) lineId: string,
    @ValidBody(quantitySchema) body: z.infer<typeof quantitySchema>,
  ): Promise<BasketDto> {
    return this.changed(await this.baskets.setQuantity(basketId, lineId, body.quantity));
  }

  @Put(':id/contact')
  @Accepts(contactSchema)
  @Returns(basketSchema)
  async setContact(
    @ValidParam('id', id) basketId: string,
    @ValidBody(contactSchema) body: z.infer<typeof contactSchema>,
  ): Promise<BasketDto> {
    return this.changed(await this.baskets.setContact(basketId, body.email, body.address));
  }

  // A code that doesn't apply is not saved: the answer says why, and the basket stays as it was.
  @Put(':id/promotion')
  @Accepts(promotionCodeSchema)
  @Returns(basketSchema)
  @Fails([404, 'No such basket'], [422, 'Unknown, ended or used-up code, or not enough spent'])
  async applyCode(
    @ValidParam('id', id) basketId: string,
    @ValidBody(promotionCodeSchema) body: z.infer<typeof promotionCodeSchema>,
  ): Promise<BasketDto> {
    const view = await this.changed(await this.baskets.setPromotionCode(basketId, body.code));
    if (!view.promotionProblem) return view;
    await this.baskets.setPromotionCode(basketId, null);
    throw new UnprocessableEntityException(view.promotionProblem);
  }

  @Delete(':id/promotion')
  @Returns(basketSchema)
  async removeCode(@ValidParam('id', id) basketId: string): Promise<BasketDto> {
    return this.changed(await this.baskets.setPromotionCode(basketId, null));
  }

  @Get(':id/delivery-options')
  @Returns(z.array(deliveryOptionSchema))
  async deliveryOptions(@ValidParam('id', id) basketId: string) {
    return this.delivery.options(await this.basket(basketId));
  }

  @Put(':id/delivery')
  @Accepts(deliveryChoiceSchema)
  @Returns(basketSchema)
  @Fails([422, 'That way of delivering is not available for this basket'])
  async chooseDelivery(
    @ValidParam('id', id) basketId: string,
    @ValidBody(deliveryChoiceSchema) body: z.infer<typeof deliveryChoiceSchema>,
  ): Promise<BasketDto> {
    return this.afterDelivery(
      basketId,
      await this.delivery.choose(await this.basket(basketId), body.shipment),
    );
  }

  @Get(':id/delivery-days')
  @Returns(z.array(deliveryDayOptionSchema))
  @Fails([404, 'No pallet days for this postcode'], [422, 'No postcode yet'])
  async deliveryDays(@ValidParam('id', id) basketId: string) {
    const result = await this.delivery.days(await this.basket(basketId));
    if (!result.ok) fail(result.problem, result.status);
    return result.value;
  }

  @Put(':id/delivery-day')
  @Accepts(deliveryDaySchema)
  @Returns(basketSchema)
  @Fails([409, 'That day is full'], [422, 'That day is not offered'])
  async holdDay(
    @ValidParam('id', id) basketId: string,
    @ValidBody(deliveryDaySchema) body: z.infer<typeof deliveryDaySchema>,
  ): Promise<BasketDto> {
    return this.afterDelivery(
      basketId,
      await this.delivery.holdDay(await this.basket(basketId), body.date),
    );
  }

  @Put(':id/access')
  @Accepts(accessAnswersSchema)
  @Returns(basketSchema)
  async answerAccess(
    @ValidParam('id', id) basketId: string,
    @ValidBody(accessAnswersSchema) body: z.infer<typeof accessAnswersSchema>,
  ): Promise<BasketDto> {
    await this.delivery.answerAccess(await this.basket(basketId), body);
    return this.views.view(await this.basket(basketId));
  }

  @Post(':id/payment')
  @HttpCode(200)
  @Returns(paymentStartSchema)
  @Fails([422, 'Something needs finishing before paying'])
  async startPayment(
    @ValidParam('id', id) basketId: string,
  ): Promise<z.infer<typeof paymentStartSchema>> {
    const result = await this.checkout.startPayment(basketId);
    if (!result.ok) fail(result.problem, result.status);
    return { provider: (await this.find(basketId)).payment, ...result.value };
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Accepts(completeSchema)
  @Returns(placedSchema)
  @Fails([402, 'The payment has not gone through'], [422, 'Something needs finishing first'])
  async complete(
    @ValidParam('id', id) basketId: string,
    @ValidBody(completeSchema) body: z.infer<typeof completeSchema>,
  ): Promise<z.infer<typeof placedSchema>> {
    const result = await this.checkout.complete(basketId, body.paymentReference);
    if (!result.ok) fail(result.problem, result.status);
    return { orderId: result.value };
  }

  private async basket(basketId: string): Promise<Basket> {
    const basket = await this.baskets.find(basketId);
    if (!basket) throw new NotFoundException('Basket not found');
    return basket;
  }

  private async changed(result: BasketChange): Promise<BasketDto> {
    if (!result.ok) fail(result.problem, result.status ?? 400);
    return this.views.view(result.basket);
  }

  private async afterDelivery(basketId: string, result: DeliveryResult<void>): Promise<BasketDto> {
    if (!result.ok) fail(result.problem, result.status);
    return this.views.view(await this.basket(basketId));
  }
}
