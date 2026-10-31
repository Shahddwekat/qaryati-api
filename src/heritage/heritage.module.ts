import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { HeritageController } from './heritage.controller';
import { HeritageService } from './heritage.service';
import { HistoricalEventsController } from './historical-events.controller';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [HeritageController, HistoricalEventsController],
  providers: [HeritageService],
})
export class HeritageModule {}
