import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ListVillagesQueryDto } from './dto/list-villages-query.dto';
import { VillagesService } from './villages.service';

// Public read endpoints. Facts about a village live in their own modules
// (e.g. GET /villages/:id/population, /villages/:id/landmarks).
@Controller('villages')
export class VillagesController {
  constructor(private readonly villages: VillagesService) {}

  @Get()
  list(@Query() query: ListVillagesQueryDto) {
    return this.villages.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.villages.findOne(id);
  }
}
