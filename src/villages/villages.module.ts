import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VillageCommandsService } from './village-commands.service';
import { VillagesController } from './villages.controller';
import { VillagesService } from './villages.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, GeocodingModule],
  controllers: [VillagesController],
  providers: [VillagesService, VillageCommandsService],
  exports: [VillagesService],
})
export class VillagesModule {}
