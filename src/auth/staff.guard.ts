import {
  applyDecorators,
  createParamDecorator,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { can, type Permission } from './roles.js';
import type { StaffUser } from './staff-user.repository.js';

const PERMISSION = 'staff-permission';

type StaffRequest = Request & { staff?: StaffUser; sessionToken?: string };

export function bearerToken(request: Request): string | null {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const token = bearerToken(request);
    const user = token ? await this.auth.userFor(token) : null;
    if (!token || !user) throw new UnauthorizedException('Sign in to continue');

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission && !can(user.role, permission)) {
      throw new ForbiddenException('Your role does not allow this');
    }
    request.staff = user;
    request.sessionToken = token;
    return true;
  }
}

// Signed-in staff only; with a permission, only roles that have it.
export const StaffOnly = (permission?: Permission) =>
  applyDecorators(
    ...(permission ? [SetMetadata(PERMISSION, permission)] : []),
    UseGuards(StaffGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Not signed in' }),
    ApiForbiddenResponse({ description: 'The role does not allow this' }),
  );

export const CurrentStaff = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<StaffRequest>().staff as StaffUser,
);

export const SessionToken = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<StaffRequest>().sessionToken as string,
);
