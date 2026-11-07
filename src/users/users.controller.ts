
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token.',
  })
  getProfile(@CurrentUser() user: CurrentUserData) {
    return user;
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all users',
    description: 'ADMIN role required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN can list users.',
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a user role',
    description:
      'ADMIN role required. Records the role change in audit logs.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Target user ID.',
    example: 4,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role'],
      properties: {
        role: {
          type: 'string',
          enum: [
            UserRole.ADMIN,
            UserRole.VERIFIER,
            UserRole.CONTRIBUTOR,
          ],
          example: UserRole.VERIFIER,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role or prohibited self-demotion.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'ADMIN role required.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.usersService.updateRole(
      id,
      dto.role,
      currentUserId,
    );
  }

  @Patch(':id/disable')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Disable a user account',
    description:
      'ADMIN role required. Disables a user and creates an audit log.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Target user ID.',
    example: 4,
  })
  @ApiResponse({
    status: 200,
    description: 'User disabled successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Account already disabled or self-disable attempt.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'ADMIN role required.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  disableUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.usersService.disableUser(
      id,
      currentUserId,
    );
  }
}
