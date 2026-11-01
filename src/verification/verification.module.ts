import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VerificationController } from './verification.controller';
import { VerificationQueueService } from './verification-queue.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [VerificationController],
  providers: [VerificationService, VerificationQueueService],
  exports: [VerificationService],
})
export class VerificationModule {}
