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
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';
import { ENTITY_TYPE_VALUES, FOUR_EYES_NOTE } from './verification.docs';
import { ENTITY_SLUG_LIST } from './verification.types';

/**
 * Review endpoints that work for EVERY kind of fact, so feature modules do not
 * need their own verify/reject controllers.
 *   PATCH /verification/landmarks/7/verify
 *   PATCH /verification/population-records/12/prefer
 */
const ENTITY_TYPE_PARAM = {
  name: 'entityType',
  enum: [...ENTITY_SLUG_LIST],
  description: `Kind of fact to review. One of: ${ENTITY_TYPE_VALUES}. Any other value gives 404.`,
};

@ApiTags('verification')
@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VERIFIER, UserRole.ADMIN)
export class VerificationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly queue: VerificationQueueService,
  ) {}

  @Get('queue')
  @ApiOperation({
    summary: 'Review queue: facts waiting for a decision (VERIFIER, ADMIN)',
    description:
      'Pending facts of all types, oldest first. Your own submissions are left out, because the four-eyes rule forbids you from reviewing them. ' +
      `Filter with \`entityType\`; allowed values: ${ENTITY_TYPE_VALUES}. ` +
      'Each item has `type` and `id`, which you use in the verify, reject and prefer URLs.',
  })
  @ApiErrors(400, 401, 403)
  getQueue(
    @Query() query: QueueQueryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.queue.list(query, user);
  }

  @Patch(':entityType/:id/verify')
  @ApiParam(ENTITY_TYPE_PARAM)
  @ApiOperation({
    summary: 'Verify a pending fact (VERIFIER, ADMIN)',
    description: `PENDING becomes VERIFIED, and the reviewer and time are recorded. ${FOUR_EYES_NOTE} A fact that is not PENDING gives 409.`,
  })
  @ApiErrors(400, 401, 403, 404, 409)
  verify(
    @Param('entityType', ParseVerifiableEntityPipe) entity: VerifiableEntity,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.verify(entity, id, user, ip);
  }

  @Patch(':entityType/:id/reject')
  @ApiParam(ENTITY_TYPE_PARAM)
  @ApiOperation({
    summary: 'Reject a fact (VERIFIER, ADMIN)',
    description: `A \`reason\` is required. A PENDING or VERIFIED fact becomes REJECTED and, if it was preferred, loses that flag. A rejected fact is final (409): the contributor adds a corrected fact instead. ${FOUR_EYES_NOTE}`,
  })
  @ApiErrors(400, 401, 403, 404, 409)
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
  @ApiParam(ENTITY_TYPE_PARAM)
  @ApiOperation({
    summary: 'Mark a verified fact as the preferred value (VERIFIER, ADMIN)',
    description:
      'Only for types that have a preferred value: village-names (one per village, language and type) and population-records (one per village and year); other types give 400. ' +
      'The fact must be VERIFIED (409 otherwise). The previous preferred value of the same group is cleared.',
  })
  @ApiErrors(400, 401, 403, 404, 409)
  prefer(
    @Param('entityType', ParseVerifiableEntityPipe) entity: VerifiableEntity,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.prefer(entity, id, user, ip);
  }
}
