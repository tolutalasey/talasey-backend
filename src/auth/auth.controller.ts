import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { Accepts, Fails, Returns, ValidBody } from '../common/contract.js';
import { meSchema, sessionSchema, signInSchema, type SignIn } from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { permissionsOf } from './roles.js';
import { CurrentStaff, SessionToken, StaffOnly } from './staff.guard.js';
import type { StaffUser } from './staff-user.repository.js';

const withPermissions = (user: StaffUser) => ({ ...user, permissions: permissionsOf(user.role) });

@ApiTags('staff sign-in')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sign-in')
  @HttpCode(200)
  @Accepts(signInSchema)
  @Returns(sessionSchema)
  @Fails([401, 'Wrong email or password'], [429, 'Too many failed attempts'])
  async signIn(@ValidBody(signInSchema) body: SignIn): Promise<z.infer<typeof sessionSchema>> {
    const result = await this.auth.signIn(body.email, body.password);
    if (result.status === 'locked') {
      throw new HttpException(
        'Too many failed attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (result.status === 'wrong-details') {
      throw new UnauthorizedException('That email and password do not match an account');
    }
    return { token: result.token, user: withPermissions(result.user) };
  }

  @Get('me')
  @StaffOnly()
  @Returns(meSchema)
  me(@CurrentStaff() user: StaffUser): z.infer<typeof meSchema> {
    return withPermissions(user);
  }

  @Post('sign-out')
  @HttpCode(204)
  @StaffOnly()
  async signOut(@SessionToken() token: string): Promise<void> {
    await this.auth.signOut(token);
  }
}
