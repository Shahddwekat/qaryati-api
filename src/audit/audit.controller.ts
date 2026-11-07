
import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/client';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit logs',
    description:
      'ADMIN only. Returns audit logs with pagination and optional filters.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number, starting from 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Number of records per page, between 1 and 100.',
  })
  @ApiQuery({
    name: 'entityType',
    required: false,
    type: String,
    example: 'User',
    description: 'Filter by entity type.',
  })
  @ApiQuery({
    name: 'entityId',
    required: false,
    type: Number,
    example: 4,
    description: 'Filter by a positive entity ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs returned successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination or filter parameters.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token.',
  })
  @ApiResponse({
    status: 403,
    description: 'ADMIN role required.',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,

    @Query('entityType')
    entityType?: string,

    @Query('entityId')
    entityId?: string,
  ) {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'Page must be >= 1 and limit must be between 1 and 100',
      );
    }

    let parsedEntityId: number | undefined;

    if (entityId !== undefined) {
      parsedEntityId = Number(entityId);

      if (
        !Number.isSafeInteger(parsedEntityId) ||
        parsedEntityId < 1
      ) {
        throw new BadRequestException(
          'entityId must be a positive integer',
        );
      }
    }

    if (
      entityType !== undefined &&
      (typeof entityType !== 'string' ||
        entityType.trim() === '')
    ) {
      throw new BadRequestException(
        'entityType must be a non-empty string',
      );
    }

    return this.auditService.findAll(
      (page - 1) * limit,
      limit,
      entityType,
      parsedEntityId,
    );
  }
}
