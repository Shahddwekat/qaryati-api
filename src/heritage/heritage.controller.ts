
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { HeritageService } from './heritage.service';

@Controller('api/v1/villages')
export class HeritageController {
  constructor(private readonly heritageService: HeritageService) { }

  // Get verified landmarks for a village
  @Get(':id/landmarks')
  getLandmarksByVillage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.heritageService.getLandmarksByVillage(id);
  }

  // Get verified historical events for a village
  @Get(':id/historical-events')
  getHistoricalEventsByVillage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.heritageService.getHistoricalEventsByVillage(id);
  }

  // Get verified cultural traits for a village
  @Get(':id/cultural-traits')
  getCulturalTraitsByVillage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.heritageService.getCulturalTraitsByVillage(id);
  }


  // Get verified economic activities for a village
  @Get(':id/economic-activities')
  getEconomicActivitiesByVillage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.heritageService.getEconomicActivitiesByVillage(id);
  }

  // Get verified facilities for a village
  @Get(':id/facilities')
  getFacilitiesByVillage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.heritageService.getFacilitiesByVillage(id);
  }

}
