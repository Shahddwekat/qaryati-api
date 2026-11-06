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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

/**
 * Names and relationships of a village. Reading is public; any signed-in role
 * can submit (as PENDING). Review: /verification/village-names/:id/... and
 * /verification/village-relations/:id/...
 */
@ApiTags('villages')
@Controller('villages')
export class VillageFactsController {
  constructor(private readonly facts: VillageFactsService) {}

  @Get(':id/names')
  @ApiOperation({
    summary: 'List the names of a village',
    description:
      'Verified and pending names, preferred first. Rejected names are hidden.',
  })
  @ApiErrors(404)
  listNames(@Param('id', ParseIntPipe) id: number) {
    return this.facts.listNames(id);
  }

  @Post(':id/names')
  @ApiOperation({
    summary: 'Add a name (any signed-in role)',
    description: 'Starts as PENDING. A HISTORICAL name needs a `sourceId`.',
  })
  @ApiErrors(400, 401, 403, 404, 409)
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
  @ApiOperation({
    summary: 'List relations of a village (both directions)',
    description:
      '`direction` is OUTGOING when this village is the subject ("3 SPLIT_FROM 1"), INCOMING otherwise.',
  })
  @ApiErrors(404)
  listRelations(@Param('id', ParseIntPipe) id: number) {
    return this.facts.listRelations(id);
  }

  @Post(':id/relations')
  @ApiOperation({
    summary: 'Add a relation (any signed-in role)',
    description:
      'Starts as PENDING. Not to itself; the opposite relation must not exist.',
  })
  @ApiErrors(400, 401, 403, 404, 409)
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
