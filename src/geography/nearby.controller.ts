import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { NearbyService } from './nearby.service';

// Public: "nearby villages" is part of a village's geography (spec).
@Controller('villages')
export class NearbyController {
  constructor(private readonly nearbyService: NearbyService) {}

  @Get(':id/nearby')
  nearby(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: NearbyQueryDto,
  ) {
    return this.nearbyService.nearby(id, query);
  }
}
