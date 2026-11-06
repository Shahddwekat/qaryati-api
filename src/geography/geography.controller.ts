import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GeographyService } from './geography.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

// Public reference data.
@ApiTags('geography')
@Controller('governorates')
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get()
  @ApiOperation({ summary: 'List the 16 governorates' })
  listGovernorates() {
    return this.geography.listGovernorates();
  }

  @Get(':id/municipalities')
  @ApiOperation({ summary: 'List the municipalities of a governorate' })
  @ApiErrors(404)
  listMunicipalities(@Param('id', ParseIntPipe) id: number) {
    return this.geography.listMunicipalities(id);
  }
}
