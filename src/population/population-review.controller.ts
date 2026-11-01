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

/**
 * Review shortcuts for population records. The rules live in VerificationService
 * (ADR-0007); this controller only gives them population-friendly URLs.
 */
@Controller('population')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VERIFIER, UserRole.ADMIN)
export class PopulationReviewController {
  constructor(private readonly verification: VerificationService) {}

  @Patch(':id/verify')
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
