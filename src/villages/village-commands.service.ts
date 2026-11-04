import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AuditAction,
  NameLanguage,
  NameType,
  Prisma,
} from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVillageDto } from './dto/create-village.dto';
import { UpdateVillageDto } from './dto/update-village.dto';
import { VillageDetail, VillagesService } from './villages.service';

const AUDIT_ENTITY = 'village';

/**
 * Rough box around historic Palestine. A geocoding result outside it is almost
 * certainly a different place with the same name, so it is not accepted.
 */
export const PALESTINE_BOUNDS = {
  minLat: 29.4,
  maxLat: 33.4,
  minLng: 34.2,
  maxLng: 35.9,
} as const;

type VillageRow = Prisma.VillageGetPayload<object>;

/**
 * Create, update, hide and restore villages (the "write side" of the module).
 * Reading lives in VillagesService. Every change and its audit row are written
 * in one transaction (ADR-0005).
 */
@Injectable()
export class VillageCommandsService {
  private readonly logger = new Logger(VillageCommandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly geocoding: GeocodingService,
    private readonly villages: VillagesService,
  ) {}

  async create(
    dto: CreateVillageDto,
    user: CurrentUserData,
    ipAddress?: string,
  ): Promise<VillageDetail> {
    assertCoordinatesTogether(dto.latitude, dto.longitude);
    const governorate = await this.ensurePlace(
      dto.governorateId,
      dto.municipalityId,
    );
    await this.assertNoDuplicateName(dto.governorateId, dto.nameAr);

    const { latitude, longitude } =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { latitude: dto.latitude, longitude: dto.longitude }
        : await this.lookUpCoordinates(dto.nameEn, governorate.nameEn);

    const id = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const village = await tx.village.create({
          data: {
            nameAr: dto.nameAr.trim(),
            nameEn: dto.nameEn.trim(),
            governorateId: dto.governorateId,
            municipalityId: dto.municipalityId,
            latitude,
            longitude,
            nameOrigin: dto.nameOrigin,
            locationDescription: dto.locationDescription,
            elevationM: dto.elevationM,
            areaDunum: dto.areaDunum,
          },
        });

        // The official names also go to village_names (PENDING, so another
        // verifier reviews them: the four-eyes rule of ADR-0007).
        await tx.villageName.createMany({
          data: [
            {
              villageId: village.id,
              name: village.nameAr,
              language: NameLanguage.AR,
              type: NameType.CURRENT,
              submittedById: user.id,
            },
            {
              villageId: village.id,
              name: village.nameEn,
              language: NameLanguage.EN,
              type: NameType.ENGLISH,
              submittedById: user.id,
            },
          ],
        });

        await this.audit.log(
          {
            userId: user.id,
            action: AuditAction.CREATE,
            entityType: AUDIT_ENTITY,
            entityId: village.id,
            afterData: snapshot(village),
            ipAddress,
          },
          tx,
        );
        return village.id;
      },
    );

    return this.villages.findOne(id);
  }

  async update(
    id: number,
    dto: UpdateVillageDto,
    user: CurrentUserData,
    ipAddress?: string,
  ): Promise<VillageDetail> {
    // A DTO built by ValidationPipe has every field as an own property set to
    // undefined, so check the values, not Object.keys().
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }
    assertCoordinatesTogether(dto.latitude, dto.longitude);

    const existing = await this.findVisibleOrThrow(id);

    const governorateId = dto.governorateId ?? existing.governorateId;
    // Moving to another governorate drops a municipality of the old one,
    // unless a new municipality is given in the same request.
    const municipalityId =
      dto.municipalityId ??
      (dto.governorateId !== undefined &&
      dto.governorateId !== existing.governorateId
        ? null
        : existing.municipalityId);
    if (dto.governorateId !== undefined || dto.municipalityId !== undefined) {
      await this.ensurePlace(governorateId, municipalityId ?? undefined);
    }

    const nameAr = dto.nameAr?.trim() ?? existing.nameAr;
    if (
      nameAr !== existing.nameAr ||
      governorateId !== existing.governorateId
    ) {
      await this.assertNoDuplicateName(governorateId, nameAr, id);
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.village.update({
        where: { id },
        data: {
          nameAr,
          nameEn: dto.nameEn?.trim(),
          governorateId,
          municipalityId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          nameOrigin: dto.nameOrigin,
          locationDescription: dto.locationDescription,
          elevationM: dto.elevationM,
          areaDunum: dto.areaDunum,
        },
      });

      // A renamed village gets the new official name as a PENDING name, so it
      // is reviewed; the old name stays in village_names as history.
      await this.addNameIfMissing(
        tx,
        id,
        updated.nameAr,
        NameLanguage.AR,
        NameType.CURRENT,
        user.id,
      );
      await this.addNameIfMissing(
        tx,
        id,
        updated.nameEn,
        NameLanguage.EN,
        NameType.ENGLISH,
        user.id,
      );

      await this.audit.log(
        {
          userId: user.id,
          action: AuditAction.UPDATE,
          entityType: AUDIT_ENTITY,
          entityId: id,
          beforeData: snapshot(existing),
          afterData: snapshot(updated),
          ipAddress,
        },
        tx,
      );
    });

    return this.villages.findOne(id);
  }

  /** Soft delete: the village and all its facts disappear from the API. */
  async hide(
    id: number,
    user: CurrentUserData,
    ipAddress?: string,
  ): Promise<{ id: number; deletedAt: Date }> {
    const existing = await this.findVisibleOrThrow(id);
    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Conditional update: if someone hid it a moment ago, nothing changes.
      const { count } = await tx.village.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt },
      });
      if (count !== 1) {
        throw new NotFoundException(`Village #${id} not found`);
      }

      await this.audit.log(
        {
          userId: user.id,
          action: AuditAction.DELETE,
          entityType: AUDIT_ENTITY,
          entityId: id,
          beforeData: snapshot(existing),
          afterData: { deletedAt: deletedAt.toISOString() },
          ipAddress,
        },
        tx,
      );
    });

    return { id, deletedAt };
  }

  /** Brings a hidden village back, with all its facts. */
  async restore(
    id: number,
    user: CurrentUserData,
    ipAddress?: string,
  ): Promise<VillageDetail> {
    const village = await this.prisma.village.findUnique({ where: { id } });
    if (!village) {
      throw new NotFoundException(`Village #${id} not found`);
    }
    if (village.deletedAt === null) {
      throw new ConflictException(`Village #${id} is not hidden`);
    }
    await this.assertNoDuplicateName(village.governorateId, village.nameAr, id);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { count } = await tx.village.updateMany({
        where: { id, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      if (count !== 1) {
        throw new ConflictException(`Village #${id} is not hidden`);
      }

      await this.audit.log(
        {
          userId: user.id,
          action: AuditAction.RESTORE,
          entityType: AUDIT_ENTITY,
          entityId: id,
          beforeData: { deletedAt: village.deletedAt!.toISOString() },
          afterData: { deletedAt: null },
          ipAddress,
        },
        tx,
      );
    });

    return this.villages.findOne(id);
  }

  // ───────────────────────── rules ─────────────────────────

  private async findVisibleOrThrow(id: number): Promise<VillageRow> {
    const village = await this.prisma.village.findFirst({
      where: { id, deletedAt: null },
    });
    if (!village) {
      throw new NotFoundException(`Village #${id} not found`);
    }
    return village;
  }

  /**
   * The governorate must exist, and a municipality (if any) must belong to it
   * (data dictionary: "service rule").
   */
  private async ensurePlace(
    governorateId: number,
    municipalityId?: number,
  ): Promise<{ id: number; nameEn: string }> {
    const governorate = await this.prisma.governorate.findUnique({
      where: { id: governorateId },
      select: { id: true, nameEn: true },
    });
    if (!governorate) {
      throw new BadRequestException(
        `Governorate #${governorateId} does not exist`,
      );
    }

    if (municipalityId !== undefined) {
      const municipality = await this.prisma.municipality.findUnique({
        where: { id: municipalityId },
        select: { governorateId: true },
      });
      if (!municipality) {
        throw new BadRequestException(
          `Municipality #${municipalityId} does not exist`,
        );
      }
      if (municipality.governorateId !== governorateId) {
        throw new BadRequestException(
          `Municipality #${municipalityId} is not in governorate #${governorateId}`,
        );
      }
    }
    return governorate;
  }

  /** Two visible villages in the same governorate cannot share an Arabic name. */
  private async assertNoDuplicateName(
    governorateId: number,
    nameAr: string,
    ignoreId?: number,
  ): Promise<void> {
    const duplicate = await this.prisma.village.findFirst({
      where: {
        governorateId,
        nameAr: nameAr.trim(),
        deletedAt: null,
        ...(ignoreId !== undefined && { id: { not: ignoreId } }),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `A village with this Arabic name already exists in this governorate (id ${duplicate.id})`,
      );
    }
  }

  /**
   * Coordinates are required (ADR-0006). If the contributor did not give them,
   * ask the geocoding provider; refuse results outside Palestine.
   */
  private async lookUpCoordinates(
    nameEn: string,
    governorateEn: string,
  ): Promise<{ latitude: number; longitude: number }> {
    const query = `${nameEn.trim()}, ${governorateEn}, Palestine`;

    let result: Awaited<ReturnType<GeocodingService['geocode']>>;
    try {
      result = await this.geocoding.geocode(query);
    } catch (error) {
      this.logger.warn(`Geocoding failed for "${query}": ${String(error)}`);
      throw new ServiceUnavailableException(
        'The geocoding service is not available right now. Please send latitude and longitude.',
      );
    }

    if (!result || !isInPalestine(result.latitude, result.longitude)) {
      throw new UnprocessableEntityException(
        `Could not find coordinates for "${query}". Please send latitude and longitude.`,
      );
    }
    return {
      latitude: round6(result.latitude),
      longitude: round6(result.longitude),
    };
  }

  private async addNameIfMissing(
    tx: Prisma.TransactionClient,
    villageId: number,
    name: string,
    language: NameLanguage,
    type: NameType,
    userId: number,
  ): Promise<void> {
    const exists = await tx.villageName.findUnique({
      where: { villageId_name_type: { villageId, name, type } },
      select: { id: true },
    });
    if (!exists) {
      await tx.villageName.create({
        data: { villageId, name, language, type, submittedById: userId },
      });
    }
  }
}

// ───────────────────────── helpers ─────────────────────────

export function assertCoordinatesTogether(
  latitude?: number,
  longitude?: number,
): void {
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new BadRequestException(
      'Send latitude and longitude together, or neither (then they are geocoded)',
    );
  }
}

export function isInPalestine(latitude: number, longitude: number): boolean {
  return (
    latitude >= PALESTINE_BOUNDS.minLat &&
    latitude <= PALESTINE_BOUNDS.maxLat &&
    longitude >= PALESTINE_BOUNDS.minLng &&
    longitude <= PALESTINE_BOUNDS.maxLng
  );
}

/** DECIMAL(9,6) keeps 6 decimal places. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** JSON-safe copy of a village for the audit log. */
function snapshot(v: VillageRow): Prisma.InputJsonValue {
  return {
    nameAr: v.nameAr,
    nameEn: v.nameEn,
    governorateId: v.governorateId,
    municipalityId: v.municipalityId,
    latitude: Number(v.latitude),
    longitude: Number(v.longitude),
    nameOrigin: v.nameOrigin,
    locationDescription: v.locationDescription,
    elevationM: v.elevationM,
    areaDunum: v.areaDunum === null ? null : Number(v.areaDunum),
  };
}
