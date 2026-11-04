import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  NameType,
  Prisma,
  VerificationStatus,
} from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { VerifiableEntity } from '../verification/verification.types';
import { CreateVillageNameDto } from './dto/create-village-name.dto';
import { CreateVillageRelationDto } from './dto/create-village-relation.dto';

export const MIN_RELATION_YEAR = 1000;

const SOURCE = { select: { id: true, title: true, type: true } } as const;
const VILLAGE_REF = {
  select: { id: true, nameAr: true, nameEn: true },
} as const;

/**
 * Names and relationships of a village. Both are facts: they start PENDING and
 * are reviewed through the shared verification service (ADR-0007), e.g.
 * PATCH /verification/village-names/:id/verify.
 */
@Injectable()
export class VillageFactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── names ─────────────────────────

  /** Every non-rejected name, grouped by type order, preferred first. */
  async listNames(villageId: number) {
    await this.ensureVillageVisible(villageId);

    const names = await this.prisma.villageName.findMany({
      where: { villageId, status: { not: VerificationStatus.REJECTED } },
      orderBy: [{ type: 'asc' }, { isPreferred: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        language: true,
        type: true,
        periodNote: true,
        status: true,
        isPreferred: true,
        source: SOURCE,
        createdAt: true,
      },
    });
    return names.map((n) => ({ ...n, isPreferred: n.isPreferred === true }));
  }

  async addName(
    villageId: number,
    dto: CreateVillageNameDto,
    user: CurrentUserData,
    ipAddress?: string,
  ) {
    await this.ensureVillageVisible(villageId);

    // A historical name is a claim about the past: it must say where it comes from.
    if (dto.type === NameType.HISTORICAL && dto.sourceId === undefined) {
      throw new BadRequestException('A historical name needs a sourceId');
    }
    if (dto.sourceId !== undefined) {
      await this.ensureSourceExists(dto.sourceId);
    }

    const name = dto.name.trim();
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const created = await tx.villageName.create({
            data: {
              villageId,
              name,
              language: dto.language,
              type: dto.type,
              periodNote: dto.periodNote?.trim(),
              sourceId: dto.sourceId,
              submittedById: user.id,
              // status defaults to PENDING: reviewed by someone else (ADR-0007)
            },
          });

          await this.audit.log(
            {
              userId: user.id,
              action: AuditAction.CREATE,
              entityType: VerifiableEntity.VILLAGE_NAME,
              entityId: created.id,
              afterData: {
                villageId,
                name: created.name,
                language: created.language,
                type: created.type,
                periodNote: created.periodNote,
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
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(
          'This village already has this name with this type',
        );
      }
      throw error;
    }
  }

  // ───────────────────────── relations ─────────────────────────

  /**
   * Non-rejected relationships in both directions. `direction` tells how to
   * read each one: OUTGOING = "this village <type> other", INCOMING = "other
   * <type> this village". Relations with a hidden village are left out.
   */
  async listRelations(villageId: number) {
    await this.ensureVillageVisible(villageId);

    const visible = { status: { not: VerificationStatus.REJECTED } };
    const select = {
      id: true,
      type: true,
      year: true,
      status: true,
      source: SOURCE,
      createdAt: true,
    } as const;

    const [outgoing, incoming] = await Promise.all([
      this.prisma.villageRelation.findMany({
        where: { villageId, ...visible, relatedVillage: { deletedAt: null } },
        select: { ...select, relatedVillage: VILLAGE_REF },
        orderBy: [{ year: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.villageRelation.findMany({
        where: {
          relatedVillageId: villageId,
          ...visible,
          village: { deletedAt: null },
        },
        select: { ...select, village: VILLAGE_REF },
        orderBy: [{ year: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return [
      ...outgoing.map(({ relatedVillage, ...r }) => ({
        ...r,
        direction: 'OUTGOING' as const,
        otherVillage: relatedVillage,
      })),
      ...incoming.map(({ village, ...r }) => ({
        ...r,
        direction: 'INCOMING' as const,
        otherVillage: village,
      })),
    ];
  }

  async addRelation(
    villageId: number,
    dto: CreateVillageRelationDto,
    user: CurrentUserData,
    ipAddress?: string,
  ) {
    if (dto.relatedVillageId === villageId) {
      throw new BadRequestException('A village cannot be related to itself');
    }
    const currentYear = new Date().getFullYear();
    if (
      dto.year !== undefined &&
      (dto.year < MIN_RELATION_YEAR || dto.year > currentYear)
    ) {
      throw new BadRequestException(
        `year must be between ${MIN_RELATION_YEAR} and ${currentYear}`,
      );
    }

    await this.ensureVillageVisible(villageId);
    await this.ensureVillageVisible(dto.relatedVillageId);
    await this.ensureSourceExists(dto.sourceId);

    // "A split from B" and "B split from A" cannot both be true, and
    // "A merged with B" is the same fact as "B merged with A".
    const reverse = await this.prisma.villageRelation.findFirst({
      where: {
        villageId: dto.relatedVillageId,
        relatedVillageId: villageId,
        type: dto.type,
        status: { not: VerificationStatus.REJECTED },
      },
      select: { id: true },
    });
    if (reverse) {
      throw new ConflictException(
        `The opposite relation already exists (id ${reverse.id})`,
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const created = await tx.villageRelation.create({
            data: {
              villageId,
              relatedVillageId: dto.relatedVillageId,
              type: dto.type,
              year: dto.year,
              sourceId: dto.sourceId,
              submittedById: user.id,
            },
          });

          await this.audit.log(
            {
              userId: user.id,
              action: AuditAction.CREATE,
              entityType: VerifiableEntity.VILLAGE_RELATION,
              entityId: created.id,
              afterData: {
                villageId,
                relatedVillageId: created.relatedVillageId,
                type: created.type,
                year: created.year,
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
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('This relation already exists');
      }
      throw error;
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  private async ensureVillageVisible(id: number): Promise<void> {
    const village = await this.prisma.village.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!village) {
      throw new NotFoundException(`Village #${id} not found`);
    }
  }

  private async ensureSourceExists(id: number): Promise<void> {
    const source = await this.prisma.source.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!source) {
      throw new NotFoundException(`Source #${id} not found`);
    }
  }
}
