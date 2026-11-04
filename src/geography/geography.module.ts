import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GeographyController } from './geography.controller';
import { GeographyService } from './geography.service';
import { NearbyController } from './nearby.controller';
import { NearbyService } from './nearby.service';

@Module({
  imports: [PrismaModule],
  controllers: [GeographyController, NearbyController],
  providers: [GeographyService, NearbyService],
  exports: [GeographyService, NearbyService],
})
export class GeographyModule {}
