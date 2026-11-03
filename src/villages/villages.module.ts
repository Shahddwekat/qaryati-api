import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VillagesController } from './villages.controller';
import { VillagesService } from './villages.service';

@Module({
  imports: [PrismaModule],
  controllers: [VillagesController],
  providers: [VillagesService],
  exports: [VillagesService],
})
export class VillagesModule {}
