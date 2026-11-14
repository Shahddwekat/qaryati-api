import {
  Body,
  Controller,
  Get,
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
import { CreateSourceDto } from './dto/create-source.dto';
import { ListSourcesQueryDto } from './dto/list-sources-query.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { SourcesService } from './sources.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

@ApiTags('sources')
@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  // Reading references is public, like the verified facts that cite them.
  @Get()
  @ApiOperation({
    summary: 'List sources',
    description:
      'Public. Paginated. Filter by `type`, search with `q` (title, author and publisher) and sort with `sortBy` and `order`.',
  })
  @ApiErrors(400)
  list(@Query() query: ListSourcesQueryDto) {
    return this.sourcesService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one source',
    description:
      'Public. Returns the source with its type, title, author, publisher, year, link and who added it.',
  })
  @ApiErrors(400, 404)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sourcesService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a source (any logged-in user)',
    description:
      'Every fact must cite a source, so add it here first and use its `id` as `sourceId`. The same type, title and year cannot be added twice (409): use the existing source.',
  })
  @ApiErrors(400, 401, 403, 409)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  create(
    @Body() dto: CreateSourceDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.sourcesService.create(dto, user, ip);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a source (its creator, VERIFIER or ADMIN)',
    description:
      'Send only the fields to change; an empty body is rejected (400). Another contributor gets 403. The change is written to the audit log.',
  })
  @ApiErrors(400, 401, 403, 404, 409)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VERIFIER, UserRole.CONTRIBUTOR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSourceDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.sourcesService.update(id, dto, user, ip);
  }
}
