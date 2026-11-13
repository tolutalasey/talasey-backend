import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { deliveryZones } from '../database/schema/index.js';
import type { DeliveryZone, DeliveryZoneRepository } from './delivery-zone.repository.js';

@Injectable()
export class DrizzleDeliveryZoneRepository implements DeliveryZoneRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByPostcodeArea(postcodeArea: string): Promise<DeliveryZone | null> {
    const [row] = await this.db
      .select({
        postcodeArea: deliveryZones.postcodeArea,
        zone: deliveryZones.zone,
        sample: deliveryZones.sample,
      })
      .from(deliveryZones)
      .where(eq(deliveryZones.postcodeArea, postcodeArea))
      .limit(1);
    return row ?? null;
  }
}
