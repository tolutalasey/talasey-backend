export type Shipment = 'parcel' | 'pallet';

export interface DeliveryRate {
  zone: string;
  shipment: Shipment;
  maxWeightKg: number;
  pricePence: number;
  sample: boolean;
}

export interface DeliveryRateRepository {
  findRate(zone: string, shipment: Shipment, weightKg: number): Promise<DeliveryRate | null>;
}

export const DELIVERY_RATE_REPOSITORY = Symbol('DeliveryRateRepository');
