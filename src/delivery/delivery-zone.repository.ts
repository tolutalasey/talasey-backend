export interface DeliveryZone {
  postcodeArea: string;
  zone: string;
  sample: boolean;
}

export interface DeliveryZoneRepository {
  findByPostcodeArea(postcodeArea: string): Promise<DeliveryZone | null>;
}

export const DELIVERY_ZONE_REPOSITORY = Symbol('DeliveryZoneRepository');
