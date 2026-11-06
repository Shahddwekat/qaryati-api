import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { NearbyService } from './nearby.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

// Public: "nearby villages" is part of a village's geography (spec).
@ApiTags('geography')
@Controller('villages')
export class NearbyController {
  constructor(private readonly nearbyService: NearbyService) {}

  @Get(':id/nearby')
  @ApiOperation({
    summary: 'Villages near a village',
    description:
      'Within `radiusKm` (max 50), nearest first, with `distanceKm` (ADR-0006).',
  })
  @ApiErrors(400, 404)
  nearby(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: NearbyQueryDto,
  ) {
    return this.nearbyService.nearby(id, query);
  }
}
