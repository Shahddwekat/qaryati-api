import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateVillageNameDto } from './dto/create-village-name.dto';
import { CreateVillageRelationDto } from './dto/create-village-relation.dto';
import { VillageFactsService } from './village-facts.service';

/**
 * Names and relationships of a village. Reading is public; any signed-in role
 * can submit (as PENDING). Review: /verification/village-names/:id/... and
 * /verification/village-relations/:id/...
 */
@Controller('villages')
export class VillageFactsController {
  constructor(private readonly facts: VillageFactsService) {}

  @Get(':id/names')
  listNames(@Param('id', ParseIntPipe) id: number) {
    return this.facts.listNames(id);
  }

  @Post(':id/names')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  addName(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateVillageNameDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.facts.addName(id, dto, user, ip);
  }

  @Get(':id/relations')
  listRelations(@Param('id', ParseIntPipe) id: number) {
    return this.facts.listRelations(id);
  }

  @Post(':id/relations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  addRelation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateVillageRelationDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.facts.addRelation(id, dto, user, ip);
  }
}
