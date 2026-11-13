import { Global, Module } from '@nestjs/common';
import { AUDIT_LOG } from './audit-log.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';

@Global()
@Module({
  controllers: [AuditController],
  providers: [{ provide: AUDIT_LOG, useClass: DrizzleAuditLog }, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
