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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

@ApiTags('population')
@Controller('villages')
export class PopulationController {
  constructor(private readonly populationService: PopulationService) {}

  // Public: shows VERIFIED and PENDING figures, each with its status and source.
  @Get(':id/population')
  @ApiOperation({
    summary: 'Population history of a village',
    description:
      'Public. One entry per year, newest first. `preferred` is the main figure of the year: the figure a verifier marked as preferred; if none, the most recent VERIFIED figure with `isFallback: true`; if the year only has PENDING figures, `null`. ' +
      '`alternatives` are the other figures, VERIFIED before PENDING. Every figure has its status and source. Rejected figures are never shown.',
  })
  @ApiErrors(400, 404)
  list(@Param('id', ParseIntPipe) villageId: number) {
    return this.populationService.listByVillage(villageId);
  }

  @Post(':id/population')
  @ApiOperation({
    summary: 'Add a population figure (any logged-in user)',
    description:
      'The figure starts as PENDING until a verifier checks it. Rules (400 if broken): `year` from 1500 to the current year, `population` from 0 to 1,000,000, `households` not more than `population`. ' +
      'Another source may give a different figure for the same year: both are kept. The same source twice for one village and year is a 409. ' +
      'If the figure implies a change of more than 10% per year compared with the closest verified year, the response has `warnings`; the figure is still saved. ' +
      'Status, preferred flag and submitter cannot be sent.',
  })
  @ApiErrors(400, 401, 403, 404, 409)
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
