import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { CLOCK, type Clock } from '../../common/clock.js';
import type { Database } from '../../database/client.js';
import { DATABASE } from '../../database/database.module.js';
import type { Actor } from '../../audit/audit-log.js';
import { AuditService } from '../../audit/audit.service.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../../store/key-value-store.js';
import { slotTakenKey } from '../../slots/slot-cache.js';
import { todayInLondon, workingDaysFrom } from '../../slots/working-days.js';
import {
  zoneConfigInputSchema,
  zoneConfigProblems,
  type ZoneConfig,
  type ZoneConfigInput,
  type ZoneDay,
} from './zone-config.js';
import { ZoneConfigRepository, type ZoneState } from './zone-config.repository.js';

const SUBJECT = 'delivery_zone';
const CALENDAR_DAYS = 20;

export type ZoneSaveResult =
  { status: 'saved'; zone: ZoneConfig } | { status: 'invalid'; problems: string[] };

@Injectable()
export class ZoneAdminService implements OnModuleInit {
  constructor(
    private readonly zones: ZoneConfigRepository,
    private readonly audit: AuditService,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit() {
    this.audit.register<ZoneState>({
      subject: SUBJECT,
      permission: 'delivery',
      current: (executor, zone) => this.zones.find(zone, executor),
      restore: async (executor, zone, state) => {
        if (state) {
          const parsed = zoneConfigInputSchema.safeParse(state);
          const others = await this.zones.list(executor);
          const problems = parsed.success
            ? zoneConfigProblems(zone, parsed.data, others)
            : ['The old settings are no longer valid'];
          if (problems.length > 0) return problems;
        }
        await this.zones.replace(executor, zone, state);
        await this.store.delete(slotTakenKey(zone));
        return [];
      },
    });
  }

  list() {
    return this.zones.list();
  }

  async save(zone: string, input: ZoneConfigInput, actor: Actor): Promise<ZoneSaveResult> {
    const problems = zoneConfigProblems(zone, input, await this.zones.list());
    if (problems.length > 0) return { status: 'invalid', problems };

    const state: ZoneState = { ...input, sample: false };
    await this.db.transaction(async (tx) => {
      const before = await this.zones.find(zone, tx);
      await this.zones.replace(tx, zone, state);
      await this.audit.record(tx, actor, {
        subject: SUBJECT,
        subjectId: zone,
        label: zone,
        before,
        after: state,
      });
    });
    await this.store.delete(slotTakenKey(zone));
    return { status: 'saved', zone: { zone, ...state } };
  }

  async remove(zone: string, actor: Actor): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const before = await this.zones.find(zone, tx);
      if (!before) return false;
      await this.zones.replace(tx, zone, null);
      await this.audit.record(tx, actor, {
        subject: SUBJECT,
        subjectId: zone,
        label: zone,
        before,
        after: null,
      });
      return true;
    });
  }

  async calendar(zone: string): Promise<ZoneDay[] | null> {
    const state = await this.zones.find(zone);
    if (!state) return null;
    const now = this.clock();
    const dates = workingDaysFrom(todayInLondon(now), CALENDAR_DAYS);
    const rows = await this.zones.days(zone, dates[0] ?? todayInLondon(now), now);
    return dates.map((date) => {
      const taken = (status: 'held' | 'booked') =>
        rows.find((row) => row.date === date && row.status === status)?.taken ?? 0;
      return {
        date,
        capacity: state.palletsPerDay ?? 0,
        held: taken('held'),
        booked: taken('booked'),
      };
    });
  }
}
