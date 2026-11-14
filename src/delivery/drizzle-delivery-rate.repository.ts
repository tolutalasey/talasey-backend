import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { deliveryRates } from '../database/schema/index.js';
import type { DeliveryRate, DeliveryRateRepository, Shipment } from './delivery-rate.repository.js';

@Injectable()
export class DrizzleDeliveryRateRepository implements DeliveryRateRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findRate(zone: string, shipment: Shipment, weightKg: number): Promise<DeliveryRate | null> {
    const [row] = await this.db
      .select({
        zone: deliveryRates.zone,
        shipment: deliveryRates.shipment,
        maxWeightKg: deliveryRates.maxWeightKg,
        pricePence: deliveryRates.pricePence,
        sample: deliveryRates.sample,
      })
      .from(deliveryRates)
      .where(
        and(
          eq(deliveryRates.zone, zone),
          eq(deliveryRates.shipment, shipment),
          gte(deliveryRates.maxWeightKg, Math.ceil(weightKg)),
        ),
      )
      .orderBy(asc(deliveryRates.maxWeightKg))
      .limit(1);
    return row ?? null;
  }
}
