import {
  Body,
  Controller,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { RejectFactDto } from '../verification/dto/reject-fact.dto';
import { VerificationService } from '../verification/verification.service';
import { VerifiableEntity } from '../verification/verification.types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';
import { FOUR_EYES_NOTE } from '../verification/verification.docs';

/**
 * Review shortcuts for population records. The rules live in VerificationService
 * (ADR-0007); this controller only gives them population-friendly URLs.
 */
@ApiTags('population')
@Controller('population')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VERIFIER, UserRole.ADMIN)
export class PopulationReviewController {
  constructor(private readonly verification: VerificationService) {}

  @Patch(':id/verify')
  @ApiOperation({
    summary: 'Verify a population figure (VERIFIER, ADMIN)',
    description: `Same as PATCH /verification/population-records/{id}/verify. PENDING becomes VERIFIED. ${FOUR_EYES_NOTE}`,
  })
  @ApiErrors(400, 401, 403, 404, 409)
  verify(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.verify(
      VerifiableEntity.POPULATION_RECORD,
      id,
      user,
      ip,
    );
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a population figure (VERIFIER, ADMIN)',
    description: `A \`reason\` is required. The figure becomes REJECTED, is no longer shown, and is final (409 if repeated): add a corrected figure instead. ${FOUR_EYES_NOTE}`,
  })
  @ApiErrors(400, 401, 403, 404, 409)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectFactDto,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.reject(
      VerifiableEntity.POPULATION_RECORD,
      id,
      user,
      dto.reason,
      ip,
    );
  }

  @Patch(':id/prefer')
  @ApiOperation({
    summary: 'Prefer a verified figure for its year (VERIFIER, ADMIN)',
    description:
      'Makes this figure the main one of its village and year, and clears the previous preferred figure. Only VERIFIED figures can be preferred (409 otherwise).',
  })
  @ApiErrors(400, 401, 403, 404, 409)
  prefer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Ip() ip: string,
  ) {
    return this.verification.prefer(
      VerifiableEntity.POPULATION_RECORD,
      id,
      user,
      ip,
    );
  }
}
