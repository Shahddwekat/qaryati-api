import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [SourcesController],
  providers: [SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
