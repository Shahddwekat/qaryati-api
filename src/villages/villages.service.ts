import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VerificationStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Page, toPage, toSkipTake } from '../common/dto/pagination-query.dto';
import { ListVillagesQueryDto } from './dto/list-villages-query.dto';

const PLACE = { select: { id: true, nameAr: true, nameEn: true } } as const;

const SUMMARY = {
  id: true,
  nameAr: true,
  nameEn: true,
  latitude: true,
  longitude: true,
  governorate: PLACE,
  municipality: {
    select: { id: true, nameAr: true, nameEn: true, type: true },
  },
} satisfies Prisma.VillageSelect;

const DETAIL = {
  ...SUMMARY,
  nameOrigin: true,
  locationDescription: true,
  elevationM: true,
  areaDunum: true,
  createdAt: true,
  updatedAt: true,
  names: {
    // Public view: VERIFIED and PENDING names with their status, never REJECTED (ADR-0005).
    where: { status: { not: VerificationStatus.REJECTED } },
    orderBy: [{ type: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      language: true,
      type: true,
      periodNote: true,
      status: true,
      isPreferred: true,
      source: { select: { id: true, title: true, type: true } },
    },
  },
} satisfies Prisma.VillageSelect;

type VillageSummaryRow = Prisma.VillageGetPayload<{ select: typeof SUMMARY }>;
type VillageDetailRow = Prisma.VillageGetPayload<{ select: typeof DETAIL }>;

/** Decimal columns come back as Prisma.Decimal; the API returns plain numbers. */
const num = (d: Prisma.Decimal | null): number | null =>
  d === null ? null : Number(d);

@Injectable()
export class VillagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Visible (not soft-deleted) villages, filtered, sorted and paginated. */
  async list(query: ListVillagesQueryDto): Promise<Page<VillageSummary>> {
    const where: Prisma.VillageWhereInput = {
      deletedAt: null,
      ...(query.governorateId && { governorateId: query.governorateId }),
      ...(query.municipalityId && { municipalityId: query.municipalityId }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.village.findMany({
        where,
        select: SUMMARY,
        orderBy: [{ [query.sortBy]: query.order }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.village.count({ where }),
    ]);

    return toPage(rows.map(toSummary), total, query);
  }

  /** One visible village with its names. Hidden villages return 404. */
  async findOne(id: number): Promise<VillageDetail> {
    const row = await this.prisma.village.findFirst({
      where: { id, deletedAt: null },
      select: DETAIL,
    });
    if (!row) {
      throw new NotFoundException(`Village #${id} not found`);
    }
    return toDetail(row);
  }
}

export type VillageSummary = ReturnType<typeof toSummary>;
export type VillageDetail = ReturnType<typeof toDetail>;

function toSummary(v: VillageSummaryRow) {
  return {
    id: v.id,
    nameAr: v.nameAr,
    nameEn: v.nameEn,
    latitude: num(v.latitude),
    longitude: num(v.longitude),
    governorate: v.governorate,
    municipality: v.municipality,
  };
}

function toDetail(v: VillageDetailRow) {
  return {
    ...toSummary(v),
    nameOrigin: v.nameOrigin,
    locationDescription: v.locationDescription,
    elevationM: v.elevationM,
    areaDunum: num(v.areaDunum),
    names: v.names.map((n) => ({ ...n, isPreferred: n.isPreferred === true })),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}
