
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuditService],
})
export class AuditModule {}
