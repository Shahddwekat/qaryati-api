import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { HeritageModule } from './heritage/heritage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { SourcesModule } from './sources/sources.module';
import { VerificationModule } from './verification/verification.module';
import { PopulationModule } from './population/population.module';
import { GeographyModule } from './geography/geography.module';
import { VillagesModule } from './villages/villages.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    HeritageModule,
    AuthModule,
    UsersModule,
    AuditModule,
    SourcesModule,
    VerificationModule,
    PopulationModule,
    GeographyModule,
    VillagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
