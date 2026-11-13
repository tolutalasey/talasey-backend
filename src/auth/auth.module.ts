import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DrizzleStaffUserRepository } from './drizzle-staff-user.repository.js';
import { SessionService } from './session.service.js';
import { StaffGuard } from './staff.guard.js';
import { TwoFactorService } from './two-factor.service.js';
import { STAFF_USER_REPOSITORY } from './staff-user.repository.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  controllers: [AuthController, UsersController],
  providers: [
    { provide: STAFF_USER_REPOSITORY, useClass: DrizzleStaffUserRepository },
    SessionService,
    AuthService,
    TwoFactorService,
    StaffGuard,
    UsersService,
  ],
  exports: [AuthService, StaffGuard],
})
export class AuthModule {}
