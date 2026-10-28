import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { CreateCulturalTraitDto } from './dto/create-cultural-trait.dto';
import { CreateEconomicActivityDto } from './dto/create-economic-activity.dto';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { HeritageService } from './heritage.service';
import { CreateLandmarkDto } from './dto/create-landmark.dto';

@Controller('villages')
export class HeritageController {
  constructor(private readonly heritageService: HeritageService) {}

  // Get verified landmarks for a village
  @Get(':id/landmarks')
  getLandmarksByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getLandmarksByVillage(id);
  }

  // Create a landmark (authentication required)
  @Post(':id/landmarks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  createLandmark(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLandmarkDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.heritageService.createLandmark(id, dto, userId);
  }

  // Get verified historical events for a village
  @Get(':id/historical-events')
  getHistoricalEventsByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getHistoricalEventsByVillage(id);
  }

  // Get verified cultural traits for a village
  @Get(':id/cultural-traits')
  getCulturalTraitsByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getCulturalTraitsByVillage(id);
  }

  // Get verified economic activities for a village
  @Get(':id/economic-activities')
  getEconomicActivitiesByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getEconomicActivitiesByVillage(id);
  }

  // Get verified facilities for a village
  @Get(':id/facilities')
  getFacilitiesByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getFacilitiesByVillage(id);
  }

  // Create a cultural trait (authentication required)
  @Post(':id/cultural-traits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  createCulturalTrait(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCulturalTraitDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.heritageService.createCulturalTrait(id, dto, userId);
  }

  // Create an economic activity (authentication required)
  @Post(':id/economic-activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  createEconomicActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEconomicActivityDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.heritageService.createEconomicActivity(id, dto, userId);
  }

  // Create a facility (authentication required)
  @Post(':id/facilities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  createFacility(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFacilityDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.heritageService.createFacility(id, dto, userId);
  }
}
