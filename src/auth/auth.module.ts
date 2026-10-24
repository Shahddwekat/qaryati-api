

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be configured with at least 32 characters',
  );
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
