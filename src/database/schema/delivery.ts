import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const shipmentType = pgEnum('shipment_type', ['parcel', 'pallet']);
export const slotHoldStatus = pgEnum('slot_hold_status', ['held', 'booked', 'released']);

export const deliveryZones = pgTable('delivery_zone', {
  postcodeArea: text('postcode_area').primaryKey(),
  zone: text('zone').notNull(),
  sample: boolean('sample').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryRates = pgTable(
  'delivery_rate',
  {
    zone: text('zone').notNull(),
    shipment: shipmentType('shipment').notNull(),
    maxWeightKg: integer('max_weight_kg').notNull(),
    pricePence: integer('price_pence').notNull(),
    sample: boolean('sample').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.zone, table.shipment, table.maxWeightKg] })],
);

export const deliverySlotSettings = pgTable('delivery_slot_settings', {
  zone: text('zone').primaryKey(),
  palletsPerDay: integer('pallets_per_day').notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
  sample: boolean('sample').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deliverySlots = pgTable(
  'delivery_slot',
  {
    zone: text('zone').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    capacity: integer('capacity').notNull(),
  },
  (table) => [primaryKey({ columns: [table.zone, table.date] })],
);

export const deliverySlotHolds = pgTable(
  'delivery_slot_hold',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zone: text('zone').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    reference: text('reference').notNull(),
    status: slotHoldStatus('status').notNull().default('held'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('delivery_slot_hold_slot_idx').on(table.zone, table.date),
    index('delivery_slot_hold_reference_idx').on(table.reference),
  ],
);
