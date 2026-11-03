import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  VerificationStatus,
} from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  detectImplausibleChange,
  toYearlyFigures,
  validatePopulationInput,
} from './domain/population-rules';
import { VerifiableEntity } from '../verification/verification.types';
import { CreatePopulationDto } from './dto/create-population.dto';

const AUDIT_ENTITY = VerifiableEntity.POPULATION_RECORD; // 'population_record'

type PopulationWithSource = Prisma.PopulationRecordGetPayload<{
  include: { source: { select: { id: true; title: true; type: true } } };
}>;

@Injectable()
export class PopulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Population history of a village: one entry per year. In each year the
   * preferred figure comes first and the other (not rejected) figures are the
   * alternatives, so conflicting sources stay visible (ADR-0005).
   */
  async listByVillage(villageId: number) {
    await this.ensureVillageExists(villageId);

    const records = await this.prisma.populationRecord.findMany({
      where: { villageId, status: { not: VerificationStatus.REJECTED } },
      include: { source: { select: { id: true, title: true, type: true } } },
      orderBy: [{ year: 'desc' }, { id: 'asc' }],
    });

    const byYear = new Map<number, PopulationWithSource[]>();
    for (const record of records) {
      byYear.set(record.year, [...(byYear.get(record.year) ?? []), record]);
    }

    const statusOrder = (r: PopulationWithSource) =>
      r.status === VerificationStatus.VERIFIED ? 0 : 1;

    return [...byYear.entries()].map(([year, group]) => {
      const preferred = group.find((r) => r.isPreferred === true) ?? null;
      const alternatives = group
        .filter((r) => r !== preferred)
        .sort((a, b) => statusOrder(a) - statusOrder(b) || a.id - b.id);
      return {
        year,
        preferred: preferred && this.toView(preferred),
        alternatives: alternatives.map((r) => this.toView(r)),
      };
    });
  }

  /**
   * Adds a figure. It starts as PENDING until a verifier checks it.
   * Several sources may give different figures for the same year: that is
   * allowed and kept side by side. Only the same source twice is a duplicate.
   */
  async create(
    villageId: number,
    dto: CreatePopulationDto,
    user: CurrentUserData,
    ipAddress?: string,
  ) {
    const violations = validatePopulationInput(dto, new Date().getFullYear());
    if (violations.length > 0) {
      throw new BadRequestException(violations);
    }

    await this.ensureVillageExists(villageId);
    await this.ensureSourceExists(dto.sourceId);

    const verified = await this.prisma.populationRecord.findMany({
      where: { villageId, status: VerificationStatus.VERIFIED },
      select: { id: true, year: true, population: true, isPreferred: true },
    });
    const warnings = detectImplausibleChange(
      { year: dto.year, population: dto.population },
      toYearlyFigures(verified),
    );

    try {
      const record = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const created = await tx.populationRecord.create({
            data: {
              villageId,
              year: dto.year,
              population: dto.population,
              households: dto.households,
              notes: dto.notes,
              sourceId: dto.sourceId,
              submittedById: user.id,
              // status defaults to PENDING: a contributor cannot self-verify
            },
          });

          await this.audit.log(
            {
              userId: user.id,
              action: AuditAction.CREATE,
              entityType: AUDIT_ENTITY,
              entityId: created.id,
              afterData: {
                villageId,
                year: created.year,
                population: created.population,
                households: created.households,
                sourceId: created.sourceId,
                status: created.status,
              },
              ipAddress,
            },
            tx,
          );
          return created;
        },
      );
      return { record, warnings };
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(
          'This source already gave a figure for this village and year',
        );
      }
      throw error;
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  private toView(r: PopulationWithSource) {
    return {
      id: r.id,
      population: r.population,
      households: r.households,
      notes: r.notes,
      status: r.status,
      isPreferred: r.isPreferred === true,
      source: r.source,
      verifiedAt: r.verifiedAt,
      createdAt: r.createdAt,
    };
  }

  private async ensureVillageExists(villageId: number): Promise<void> {
    const village = await this.prisma.village.findFirst({
      where: { id: villageId, deletedAt: null },
      select: { id: true },
    });
    if (!village) {
      throw new NotFoundException('Village not found');
    }
  }

  private async ensureSourceExists(sourceId: number): Promise<void> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });
    if (!source) {
      throw new NotFoundException('Source not found');
    }
  }
}
