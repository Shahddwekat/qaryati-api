import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GeographyController } from './geography.controller';
import { GeographyService } from './geography.service';

@Module({
  imports: [PrismaModule],
  controllers: [GeographyController],
  providers: [GeographyService],
  exports: [GeographyService],
})
export class GeographyModule {}
