import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { HeritageService } from './heritage.service';
import { CreateHistoricalEventDto } from './dto/create-historical-event.dto';

import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('historical-events')
export class HistoricalEventsController {
  constructor(private readonly heritageService: HeritageService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  createHistoricalEvent(
    @Body() dto: CreateHistoricalEventDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.heritageService.createHistoricalEvent(dto, userId);
  }
}
