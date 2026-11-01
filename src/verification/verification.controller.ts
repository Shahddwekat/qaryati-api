import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { QueueQueryDto } from './dto/queue-query.dto';
import { RejectFactDto } from './dto/reject-fact.dto';
import { ParseVerifiableEntityPipe } from './parse-verifiable-entity.pipe';
import { VerificationQueueService } from './verification-queue.service';
import { VerificationService } from './verification.service';
import { VerifiableEntity } from './verification.types';

/**
 * Review endpoints that work for EVERY kind of fact, so feature modules do not
 * need their own verify/reject controllers.
 *   PATCH /verification/landmarks/7/verify
 *   PATCH /verification/population-records/12/prefer
 */
@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VERIFIER, UserRole.ADMIN)
export class VerificationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly queue: VerificationQueueService,
  ) {}

  @Get('queue')
  getQueue(
    @Query() query: QueueQueryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.queue.list(query, user);
  }

  @Patch(':entityType/:id/verify')
  verify(
    @Param('entityType', ParseVerifiableEntityPipe) entity: VerifiableEntity,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.verify(entity, id, user, ip);
  }

  @Patch(':entityType/:id/reject')
  reject(
    @Param('entityType', ParseVerifiableEntityPipe) entity: VerifiableEntity,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectFactDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.reject(entity, id, user, dto.reason, ip);
  }

  @Patch(':entityType/:id/prefer')
  prefer(
    @Param('entityType', ParseVerifiableEntityPipe) entity: VerifiableEntity,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.prefer(entity, id, user, ip);
  }
}
