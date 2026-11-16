import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { HeritageService } from './heritage.service';
import { CreateHistoricalEventDto } from './dto/create-historical-event.dto';

import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

@ApiTags('heritage')
@Controller('historical-events')
export class HistoricalEventsController {
  constructor(private readonly heritageService: HeritageService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a historical event linked to villages (any signed-in role)',
    description:
      'One event can belong to several villages: send their ids in `villageIds`. If one of them does not exist or is hidden, the answer is 400. An unknown `sourceId` gives 404. The event starts as PENDING.',
  })
  @ApiErrors(400, 401, 403, 404)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  createHistoricalEvent(
    @Body() dto: CreateHistoricalEventDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.heritageService.createHistoricalEvent(dto, userId);
  }
}
