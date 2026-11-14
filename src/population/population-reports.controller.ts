import { Controller, Get, Query } from '@nestjs/common';
import { PopulationTrendsQueryDto } from './dto/population-trends-query.dto';
import { PopulationReportsService } from './population-reports.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

@ApiTags('population')
@Controller('reports')
export class PopulationReportsController {
  constructor(private readonly reports: PopulationReportsService) {}

  // Public: it only aggregates VERIFIED figures.
  @Get('population-trends')
  @ApiOperation({
    summary: 'Population trends: total population per year',
    description:
      'Public. For one governorate (`governorate`, English or Arabic name) or for all. Each village counts once per year: its preferred VERIFIED figure, otherwise its most recent VERIFIED one. ' +
      '`villagesCount` is how many villages the total covers, so compare totals only together with it. An unknown governorate gives 404.',
  })
  @ApiErrors(400, 404)
  trends(@Query() query: PopulationTrendsQueryDto) {
    return this.reports.trends(query.governorate);
  }
}
