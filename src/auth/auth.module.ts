
import 'dotenv/config';

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be configured with at least 32 characters',
  );
}

const accessTokenTtlMinutes = Number(
  process.env.JWT_ACCESS_TOKEN_TTL_MINUTES ?? '15',
);

if (
  !Number.isSafeInteger(accessTokenTtlMinutes) ||
  accessTokenTtlMinutes < 1
) {
  throw new Error(
    'JWT_ACCESS_TOKEN_TTL_MINUTES must be a positive integer',
  );
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: accessTokenTtlMinutes * 60,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuditService, LoginRateLimitGuard],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
