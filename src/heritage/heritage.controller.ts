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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

@ApiTags('heritage')
@Controller('villages')
export class HeritageController {
  constructor(private readonly heritageService: HeritageService) {}

  // Get verified landmarks for a village
  @Get(':id/landmarks')
  @ApiOperation({
    summary: 'List the landmarks of a village',
    description:
      'Public. Returns the landmarks of the village that are not rejected (PENDING and VERIFIED), each with its source title and type. A hidden or unknown village gives 404.',
  })
  @ApiErrors(400, 404)
  getLandmarksByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getLandmarksByVillage(id);
  }

  // Create a landmark (authentication required)
  @Post(':id/landmarks')
  @ApiOperation({
    summary: 'Add a landmark (any signed-in role)',
    description:
      'Starts as PENDING until a verifier approves it. `sourceId` must be an existing source (404 if not). The change is written to the audit log.',
  })
  @ApiErrors(400, 401, 403, 404)
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
  @ApiOperation({
    summary: 'List the historical events of a village',
    description:
      'Public. Returns the events linked to the village that are not rejected (PENDING and VERIFIED), sorted by `yearFrom`, with the source title and type.',
  })
  @ApiErrors(400, 404)
  getHistoricalEventsByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getHistoricalEventsByVillage(id);
  }

  // Get verified cultural traits for a village
  @Get(':id/cultural-traits')
  @ApiOperation({
    summary: 'List the cultural traits of a village',
    description:
      'Public. Returns food, crafts, dress, music, festivals, dialect and customs that are not rejected (PENDING and VERIFIED), with their source.',
  })
  @ApiErrors(400, 404)
  getCulturalTraitsByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getCulturalTraitsByVillage(id);
  }

  // Get verified economic activities for a village
  @Get(':id/economic-activities')
  @ApiOperation({
    summary: 'List the economic activities of a village',
    description:
      'Public. Returns the activities of the village that are not rejected (PENDING and VERIFIED), with their source.',
  })
  @ApiErrors(400, 404)
  getEconomicActivitiesByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getEconomicActivitiesByVillage(id);
  }

  // Get verified facilities for a village
  @Get(':id/facilities')
  @ApiOperation({
    summary: 'List the facilities of a village',
    description:
      'Public. Returns schools, clinics, water, electricity and other facilities whose `verificationStatus` is not REJECTED, with their source.',
  })
  @ApiErrors(400, 404)
  getFacilitiesByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getFacilitiesByVillage(id);
  }

  // Create a cultural trait (authentication required)
  @Post(':id/cultural-traits')
  @ApiOperation({
    summary: 'Add a cultural trait (any signed-in role)',
    description:
      'Starts as PENDING until a verifier approves it. `sourceId` must be an existing source (404 if not).',
  })
  @ApiErrors(400, 401, 403, 404)
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
  @ApiOperation({
    summary: 'Add an economic activity (any signed-in role)',
    description:
      'Starts as PENDING until a verifier approves it. `yearTo` cannot be before `yearFrom` (400). `sourceId` must exist (404).',
  })
  @ApiErrors(400, 401, 403, 404)
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
  @ApiOperation({
    summary: 'Add a facility (any signed-in role)',
    description:
      'Starts with `verificationStatus` PENDING. Send `latitude` and `longitude` as valid coordinates (max 6 decimals). `sourceId` must exist (404).',
  })
  @ApiErrors(400, 401, 403, 404)
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
