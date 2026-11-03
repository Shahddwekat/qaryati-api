import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GeographyService } from './geography.service';

// Public reference data.
@Controller('governorates')
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get()
  listGovernorates() {
    return this.geography.listGovernorates();
  }

  @Get(':id/municipalities')
  listMunicipalities(@Param('id', ParseIntPipe) id: number) {
    return this.geography.listMunicipalities(id);
  }
}
