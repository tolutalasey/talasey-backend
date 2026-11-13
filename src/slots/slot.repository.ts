export type SlotHoldStatus = 'held' | 'booked' | 'released';

export interface SlotSettings {
  zone: string;
  palletsPerDay: number;
  leadTimeDays: number;
  sample: boolean;
}

export interface SlotHold {
  id: string;
  zone: string;
  date: string;
  reference: string;
  status: SlotHoldStatus;
  expiresAt: Date;
}

export interface NewSlotHold {
  zone: string;
  date: string;
  reference: string;
  capacity: number;
  expiresAt: Date;
  now: Date;
}

export type HoldOutcome = { status: 'held'; hold: SlotHold } | { status: 'full' };

export type ConfirmOutcome =
  | { status: 'booked'; hold: SlotHold }
  | { status: 'not-found' }
  | { status: 'released' }
  | { status: 'full' };

// A hold counts against a slot while it is booked, or held and not yet expired.
// hold() and confirm() lock the slot row, so concurrent requests cannot overbook it.
export interface SlotRepository {
  findSettings(zone: string): Promise<SlotSettings | null>;
  countTaken(zone: string, dates: string[], now: Date): Promise<Map<string, number>>;
  hold(input: NewSlotHold): Promise<HoldOutcome>;
  confirm(id: string, now: Date): Promise<ConfirmOutcome>;
  release(id: string): Promise<SlotHold | null>;
  findHold(id: string): Promise<SlotHold | null>;
}

export const SLOT_REPOSITORY = Symbol('SlotRepository');
