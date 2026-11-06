import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateVillageDto } from './dto/create-village.dto';
import { ListVillagesQueryDto } from './dto/list-villages-query.dto';
import { UpdateVillageDto } from './dto/update-village.dto';
import { VillageCommandsService } from './village-commands.service';
import { VillagesService } from './villages.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

// Reading is public. Facts about a village live in their own modules
// (e.g. GET /villages/:id/population, /villages/:id/landmarks).
@ApiTags('villages')
@Controller('villages')
export class VillagesController {
  constructor(
    private readonly villages: VillagesService,
    private readonly commands: VillageCommandsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List villages',
    description:
      'Paginated, with filters. With `q`, searches all names (Arabic, English, historical, transliterations) by relevance.',
  })
  @ApiErrors(400)
  list(@Query() query: ListVillagesQueryDto) {
    return this.villages.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one village with its governorate and municipality',
  })
  @ApiErrors(404)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.villages.findOne(id);
  }

  // Data dictionary: only VERIFIER and ADMIN create villages.
  @Post()
  @ApiOperation({
    summary: 'Create a village (VERIFIER, ADMIN)',
    description:
      'Coordinates are optional: if missing, they are looked up by geocoding.',
  })
  @ApiErrors(400, 401, 403, 404, 409)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VERIFIER, UserRole.ADMIN)
  create(
    @Body() dto: CreateVillageDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.commands.create(dto, user, ip);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a village (VERIFIER, ADMIN)' })
  @ApiErrors(400, 401, 403, 404, 409)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VERIFIER, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVillageDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.commands.update(id, dto, user, ip);
  }

  // Hiding and restoring are admin-only (roles table in the data dictionary).
  @Delete(':id')
  @ApiOperation({
    summary: 'Hide a village (ADMIN)',
    description:
      'Soft delete: the village and its facts disappear from public endpoints.',
  })
  @ApiErrors(401, 403, 404)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  hide(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.commands.hide(id, user, ip);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a hidden village (ADMIN)' })
  @ApiErrors(401, 403, 404)
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.commands.restore(id, user, ip);
  }
}
