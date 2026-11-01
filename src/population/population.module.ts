import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VerificationModule } from '../verification/verification.module';
import { PopulationReportsController } from './population-reports.controller';
import { PopulationReportsService } from './population-reports.service';
import { PopulationReviewController } from './population-review.controller';
import { PopulationController } from './population.controller';
import { PopulationService } from './population.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, VerificationModule],
  controllers: [
    PopulationController,
    PopulationReviewController,
    PopulationReportsController,
  ],
  providers: [PopulationService, PopulationReportsService],
})
export class PopulationModule {}
