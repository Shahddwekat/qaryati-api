import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VillageCommandsService } from './village-commands.service';
import { VillageFactsController } from './village-facts.controller';
import { VillageFactsService } from './village-facts.service';
import { VillagesController } from './villages.controller';
import { VillagesService } from './villages.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, GeocodingModule],
  controllers: [VillagesController, VillageFactsController],
  providers: [VillagesService, VillageCommandsService, VillageFactsService],
  exports: [VillagesService],
})
export class VillagesModule {}
