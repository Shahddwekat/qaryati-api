import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VerificationStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Page, toPage, toSkipTake } from '../common/dto/pagination-query.dto';
import { ListVillagesQueryDto } from './dto/list-villages-query.dto';
import { MIN_TOKEN_LENGTH, toBooleanQuery } from './search-terms';

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
    if (query.q !== undefined) {
      return this.search(query);
    }

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

  /**
   * Name search with native SQL (ADR-0003): a FULLTEXT boolean-mode match on
   * every name of a village (current, English, historical, transliterations;
   * REJECTED names excluded), one row per village with its best score, ordered
   * by relevance. Prisma cannot express MATCH ... AGAINST with a score.
   */
  private async search(
    query: ListVillagesQueryDto,
  ): Promise<Page<VillageSummary>> {
    const against = toBooleanQuery(query.q ?? '');
    if (!against) {
      throw new BadRequestException(
        `q must contain at least one word of ${MIN_TOKEN_LENGTH} or more letters`,
      );
    }

    const filters = Prisma.sql`
      v.deleted_at IS NULL
      AND vn.status <> 'REJECTED'
      AND MATCH(vn.name) AGAINST (${against} IN BOOLEAN MODE)
      ${query.governorateId ? Prisma.sql`AND v.governorate_id = ${query.governorateId}` : Prisma.empty}
      ${query.municipalityId ? Prisma.sql`AND v.municipality_id = ${query.municipalityId}` : Prisma.empty}`;

    const { skip, take } = toSkipTake(query);

    const [hits, counts] = await Promise.all([
      this.prisma.$queryRaw<{ id: number | bigint; score: number }[]>(
        Prisma.sql`
          SELECT v.id, MAX(MATCH(vn.name) AGAINST (${against} IN BOOLEAN MODE)) AS score
          FROM village_names vn
          JOIN villages v ON v.id = vn.village_id
          WHERE ${filters}
          GROUP BY v.id, v.name_en
          ORDER BY score DESC, v.name_en ASC, v.id ASC
          LIMIT ${take} OFFSET ${skip}`,
      ),
      this.prisma.$queryRaw<{ total: number | bigint }[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT v.id) AS total
          FROM village_names vn
          JOIN villages v ON v.id = vn.village_id
          WHERE ${filters}`,
      ),
    ]);

    // MySQL returns ids and counts as BigInt.
    const ids = hits.map((h) => Number(h.id));
    const total = Number(counts[0]?.total ?? 0);

    const rows = ids.length
      ? await this.prisma.village.findMany({
          where: { id: { in: ids } },
          select: SUMMARY,
        })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is VillageSummaryRow => r !== undefined);

    return toPage(ordered.map(toSummary), total, query);
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
