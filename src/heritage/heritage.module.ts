
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HeritageController } from './heritage.controller';
import { HeritageService } from './heritage.service';

@Module({
  imports: [AuthModule],
  controllers: [HeritageController],
  providers: [HeritageService],
})
export class HeritageModule { }
