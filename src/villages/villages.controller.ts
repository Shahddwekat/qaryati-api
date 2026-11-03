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

// Reading is public. Facts about a village live in their own modules
// (e.g. GET /villages/:id/population, /villages/:id/landmarks).
@Controller('villages')
export class VillagesController {
  constructor(
    private readonly villages: VillagesService,
    private readonly commands: VillageCommandsService,
  ) {}

  @Get()
  list(@Query() query: ListVillagesQueryDto) {
    return this.villages.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.villages.findOne(id);
  }

  // Data dictionary: only VERIFIER and ADMIN create villages.
  @Post()
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
