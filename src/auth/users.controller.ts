import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Accepts, Fails, Returns, ValidBody, ValidParam } from '../common/contract.js';
import {
  newStaffUserSchema,
  staffUserChangesSchema,
  staffUserSchema,
  type NewStaffUserInput,
  type StaffUserChangesInput,
} from './auth.schemas.js';
import { CurrentStaff, StaffOnly } from './staff.guard.js';
import type { StaffUser } from './staff-user.repository.js';
import { UsersService, type StaffChangeResult } from './users.service.js';

function userOrThrow(result: StaffChangeResult): StaffUser {
  switch (result.status) {
    case 'ok':
      return result.user;
    case 'not-found':
      throw new NotFoundException('No such staff account');
    case 'email-taken':
      throw new ConflictException('Someone already uses that email');
    case 'last-owner':
      throw new UnprocessableEntityException('Keep at least one active owner');
  }
}

@ApiTags('staff accounts')
@Controller('admin/users')
@StaffOnly('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Returns(z.array(staffUserSchema))
  list(): Promise<StaffUser[]> {
    return this.users.list();
  }

  @Post()
  @Accepts(newStaffUserSchema)
  @Returns(staffUserSchema, 201)
  @Fails([409, 'Email already used'])
  async create(
    @ValidBody(newStaffUserSchema) body: NewStaffUserInput,
    @CurrentStaff() actor: StaffUser,
  ): Promise<StaffUser> {
    return userOrThrow(await this.users.create(body, actor));
  }

  @Patch(':id')
  @Accepts(staffUserChangesSchema)
  @Returns(staffUserSchema)
  @Fails([404, 'No such account'], [422, 'Would leave no active owner'])
  async update(
    @ValidParam('id', z.uuid()) id: string,
    @ValidBody(staffUserChangesSchema) body: StaffUserChangesInput,
    @CurrentStaff() actor: StaffUser,
  ): Promise<StaffUser> {
    return userOrThrow(await this.users.update(id, body, actor));
  }
}
