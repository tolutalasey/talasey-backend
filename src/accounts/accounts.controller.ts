import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { z } from 'zod';
import { bearerToken } from '../auth/staff.guard.js';
import { Accepts, Fails, Returns, ValidBody } from '../common/contract.js';
import {
  accountSchema,
  customerSessionSchema,
  redeemSchema,
  signInLinkSchema,
  type AccountDto,
} from './accounts.schemas.js';
import { AccountsService } from './accounts.service.js';

@ApiTags('store: customer accounts')
@Controller('store/account')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('sign-in-link')
  @HttpCode(204)
  @Accepts(signInLinkSchema)
  async sendLink(@ValidBody(signInLinkSchema) body: z.infer<typeof signInLinkSchema>) {
    await this.accounts.sendLink(body.email);
  }

  @Post('sessions')
  @HttpCode(200)
  @Accepts(redeemSchema)
  @Returns(customerSessionSchema)
  @Fails([400, 'The link has expired or was already used'])
  async redeem(@ValidBody(redeemSchema) body: z.infer<typeof redeemSchema>) {
    const session = await this.accounts.redeem(body.token);
    if (!session) throw new BadRequestException('This link has expired or was already used');
    return session;
  }

  @Get()
  @ApiBearerAuth()
  @Returns(accountSchema)
  @Fails([401, 'Not signed in'])
  async account(@Req() request: Request): Promise<AccountDto> {
    return this.accounts.account(await this.signedIn(request));
  }

  @Delete('sessions')
  @HttpCode(204)
  @ApiBearerAuth()
  async signOut(@Req() request: Request) {
    const token = bearerToken(request);
    if (token) await this.accounts.signOut(token);
  }

  private async signedIn(request: Request): Promise<string> {
    const token = bearerToken(request);
    const email = token ? await this.accounts.emailFor(token) : null;
    if (!email) throw new UnauthorizedException('Sign in to continue');
    return email;
  }
}
