import { Controller, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Accepts, Fails, Returns, ValidBody } from '../common/contract.js';
import { StockAlertsService } from './stock-alerts.service.js';

const stockAlertSchema = z.object({
  variantId: z.uuid(),
  email: z.email('Enter an email address like name@example.com'),
});

const stockAlertResultSchema = z.object({
  status: z
    .enum(['waiting', 'available'])
    .describe('waiting: we will email; available: it can be bought now'),
});

@ApiTags('store: basket and checkout')
@Controller('store/stock-alerts')
export class StockAlertsController {
  constructor(private readonly alerts: StockAlertsService) {}

  @Post()
  @HttpCode(200)
  @Accepts(stockAlertSchema)
  @Returns(stockAlertResultSchema)
  @Fails([404, 'No such option on sale'])
  async ask(
    @ValidBody(stockAlertSchema) body: z.infer<typeof stockAlertSchema>,
  ): Promise<z.infer<typeof stockAlertResultSchema>> {
    const status = await this.alerts.ask(body.variantId, body.email);
    if (status === 'no-such-option') throw new NotFoundException('No such option on sale');
    return { status };
  }
}
