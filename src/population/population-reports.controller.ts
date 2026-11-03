import { Controller, Get, Query } from '@nestjs/common';
import { PopulationTrendsQueryDto } from './dto/population-trends-query.dto';
import { PopulationReportsService } from './population-reports.service';

@Controller('reports')
export class PopulationReportsController {
  constructor(private readonly reports: PopulationReportsService) {}

  // Public: it only aggregates VERIFIED figures.
  @Get('population-trends')
  trends(@Query() query: PopulationTrendsQueryDto) {
    return this.reports.trends(query.governorate);
  }
}
