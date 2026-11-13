import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { Fails, Returns } from '../common/contract.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';

export const healthSchema = z.object({
  status: z.literal('ok'),
  store: z.enum(['redis', 'memory']),
});

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
  ) {}

  @Get()
  @Returns(healthSchema)
  @Fails([503, 'The database or Redis is unreachable'])
  async check(): Promise<z.infer<typeof healthSchema>> {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    if (!(await this.store.ping())) throw new ServiceUnavailableException('Redis unreachable');
    return { status: 'ok', store: this.store.kind };
  }
}
