import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AcceptsQuery, Fails, Returns, ValidParam, ValidQuery } from '../common/contract.js';
import { can } from '../auth/roles.js';
import { CurrentStaff, StaffOnly } from '../auth/staff.guard.js';
import type { StaffUser } from '../auth/staff-user.repository.js';
import type { AuditEntry } from './audit-log.js';
import { AuditService } from './audit.service.js';
import { auditEntrySchema, auditQuerySchema, type AuditQueryInput } from './audit.schemas.js';

type AuditEntryDto = z.infer<typeof auditEntrySchema>;

export const toAuditDto = (entry: AuditEntry): AuditEntryDto => ({
  ...entry,
  createdAt: entry.createdAt.toISOString(),
});

@ApiTags('audit log')
@Controller('admin/audit')
@StaffOnly('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @AcceptsQuery(auditQuerySchema)
  @Returns(z.array(auditEntrySchema))
  async list(
    @ValidQuery(auditQuerySchema) query: AuditQueryInput,
    @CurrentStaff() user: StaffUser,
  ): Promise<AuditEntryDto[]> {
    const visible = this.audit.subjectsFor((permission) => can(user.role, permission));
    const subjects = query.subject ? visible.filter((s) => s === query.subject) : visible;
    if (subjects.length === 0) return [];
    const entries = await this.audit.list({
      subjects,
      subjectId: query.subjectId,
      limit: query.limit,
    });
    return entries.map(toAuditDto);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Returns(auditEntrySchema, 200, 'The new entry recording the restore')
  @Fails([404, 'No such entry'], [422, 'The old version is no longer valid'])
  async restore(
    @ValidParam('id', z.uuid()) id: string,
    @CurrentStaff() user: StaffUser,
  ): Promise<AuditEntryDto> {
    const result = await this.audit.restore(id, user, (permission) => can(user.role, permission));
    switch (result.status) {
      case 'restored':
        return toAuditDto(result.entry);
      case 'not-found':
        throw new NotFoundException('No such change in the log');
      case 'not-allowed':
        throw new ForbiddenException('Your role does not allow this');
      case 'invalid':
        throw new UnprocessableEntityException(result.problems.join(' '));
    }
  }
}
