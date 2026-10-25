import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { HeritageService } from './heritage.service';

@Controller('api/v1/villages')
export class HeritageController {
  constructor(private readonly heritageService: HeritageService) {}

  @Get(':id/landmarks')
  getLandmarksByVillage(@Param('id', ParseIntPipe) id: number) {
    return this.heritageService.getLandmarksByVillage(id);
  }

  
  @Get(':id/historical-events')
  getHistoricalEventsByVillage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.heritageService.getHistoricalEventsByVillage(id);
  }

}