import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreatePopulationDto } from './dto/create-population.dto';
import { PopulationService } from './population.service';

@Controller('villages')
export class PopulationController {
  constructor(private readonly populationService: PopulationService) {}

  // Public: shows VERIFIED and PENDING figures, each with its status and source.
  @Get(':id/population')
  list(@Param('id', ParseIntPipe) villageId: number) {
    return this.populationService.listByVillage(villageId);
  }

  @Post(':id/population')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  create(
    @Param('id', ParseIntPipe) villageId: number,
    @Body() dto: CreatePopulationDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.populationService.create(villageId, dto, user, ip);
  }
}
