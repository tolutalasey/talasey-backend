import {
  Controller,
  Get,
  GoneException,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { Accepts, Fails, Returns, ValidBody } from '../common/contract.js';
import {
  meSchema,
  passwordChangeSchema,
  sessionSchema,
  signInCodeSchema,
  signInResultSchema,
  signInSchema,
  twoFactorCodeSchema,
  twoFactorSetupSchema,
  type PasswordChange,
  type SignIn,
  type SignInCode,
  type TwoFactorCode,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { permissionsOf } from './roles.js';
import { CurrentStaff, SessionToken, StaffOnly } from './staff.guard.js';
import type { StaffUser } from './staff-user.repository.js';
import { TwoFactorService, type TwoFactorChange } from './two-factor.service.js';

type Me = z.infer<typeof meSchema>;

const withPermissions = (user: StaffUser): Me => ({
  ...user,
  permissions: permissionsOf(user.role),
});

const tooManyAttempts = () =>
  new HttpException(
    'Too many failed attempts. Try again in 15 minutes.',
    HttpStatus.TOO_MANY_REQUESTS,
  );

function changedOrThrow(result: TwoFactorChange | { status: 'expired' }): Me {
  if (result.status === 'expired')
    throw new GoneException('That set-up has expired. Start again to get a new key.');
  if (result.status === 'wrong-code')
    throw new UnprocessableEntityException('That code is not right. Check the app and try again.');
  return withPermissions(result.user);
}

@ApiTags('staff sign-in')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  @Accepts(signInSchema)
  @Returns(signInResultSchema)
  @Fails([401, 'Wrong email or password'], [429, 'Too many failed attempts'])
  async signIn(@ValidBody(signInSchema) body: SignIn): Promise<z.infer<typeof signInResultSchema>> {
    const result = await this.auth.signIn(body.email, body.password);
    switch (result.status) {
      case 'locked':
        throw tooManyAttempts();
      case 'wrong-details':
        throw new UnauthorizedException('That email and password do not match an account');
      case 'code-needed':
        return result;
      case 'signed-in':
        return { status: 'signed-in', token: result.token, user: withPermissions(result.user) };
    }
  }

  @Post('sign-in/code')
  @HttpCode(200)
  @Accepts(signInCodeSchema)
  @Returns(sessionSchema)
  @Fails([401, 'Wrong code, or the sign-in expired'], [429, 'Too many failed attempts'])
  async signInCode(
    @ValidBody(signInCodeSchema) body: SignInCode,
  ): Promise<z.infer<typeof sessionSchema>> {
    const result = await this.auth.completeSignIn(body.challenge, body.code);
    switch (result.status) {
      case 'locked':
        throw tooManyAttempts();
      case 'expired':
        throw new UnauthorizedException('That sign-in has expired. Enter your password again.');
      case 'wrong-code':
        throw new UnauthorizedException('That code is not right. Check the app and try again.');
      case 'signed-in':
        return { status: 'signed-in', token: result.token, user: withPermissions(result.user) };
    }
  }

  @Get('me')
  @StaffOnly()
  @Returns(meSchema)
  me(@CurrentStaff() user: StaffUser): Me {
    return withPermissions(user);
  }

  @Post('password')
  @HttpCode(204)
  @StaffOnly()
  @Accepts(passwordChangeSchema)
  @Fails([422, 'Current password is wrong'])
  async changePassword(
    @ValidBody(passwordChangeSchema) body: PasswordChange,
    @CurrentStaff() user: StaffUser,
  ): Promise<void> {
    if (!(await this.auth.changePassword(user, body.currentPassword, body.newPassword)))
      throw new UnprocessableEntityException('Your current password is not right');
  }

  @Post('two-factor/setup')
  @HttpCode(200)
  @StaffOnly()
  @Returns(twoFactorSetupSchema)
  setUpTwoFactor(@CurrentStaff() user: StaffUser): Promise<z.infer<typeof twoFactorSetupSchema>> {
    return this.twoFactor.begin(user);
  }

  @Post('two-factor/on')
  @HttpCode(200)
  @StaffOnly()
  @Accepts(twoFactorCodeSchema)
  @Returns(meSchema)
  @Fails([410, 'The set-up expired'], [422, 'Wrong code'])
  async turnOnTwoFactor(
    @ValidBody(twoFactorCodeSchema) body: TwoFactorCode,
    @CurrentStaff() user: StaffUser,
  ): Promise<Me> {
    return changedOrThrow(await this.twoFactor.enable(user, body.code));
  }

  @Post('two-factor/off')
  @HttpCode(200)
  @StaffOnly()
  @Accepts(twoFactorCodeSchema)
  @Returns(meSchema)
  @Fails([422, 'Wrong code'])
  async turnOffTwoFactor(
    @ValidBody(twoFactorCodeSchema) body: TwoFactorCode,
    @CurrentStaff() user: StaffUser,
  ): Promise<Me> {
    return changedOrThrow(await this.twoFactor.disable(user, body.code));
  }

  @Post('sign-out')
  @HttpCode(204)
  @StaffOnly()
  async signOut(@SessionToken() token: string): Promise<void> {
    await this.auth.signOut(token);
  }
}
