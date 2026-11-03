import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface TrendRow {
  year: number | bigint;
  total_population: number | bigint;
  villages_count: number | bigint;
}

export const TRENDS_BASIS =
  'One verified figure per village and year: the preferred one, otherwise the most recent. ' +
  'Compare totals only together with villagesCount, because not every village has a figure for every year.';

@Injectable()
export class PopulationReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Total population per year, optionally for one governorate.
   * Raw SQL: it needs a window function (ROW_NUMBER) to pick exactly one figure
   * per village and year, which the ORM cannot express.
   */
  async trends(governorate?: string) {
    const name = governorate?.trim() || null;

    let governorateId: number | null = null;
    if (name) {
      const found = await this.prisma.governorate.findFirst({
        where: { OR: [{ nameEn: name }, { nameAr: name }] },
        select: { id: true },
      });
      if (!found) {
        throw new NotFoundException(`Governorate "${name}" not found`);
      }
      governorateId = found.id;
    }

    const rows = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT pr.village_id,
               pr.year,
               pr.population,
               ROW_NUMBER() OVER (
                 PARTITION BY pr.village_id, pr.year
                 ORDER BY (pr.is_preferred = 1) DESC, pr.id DESC
               ) AS rn
        FROM population_records pr
        JOIN villages v ON v.id = pr.village_id
        WHERE pr.status = 'VERIFIED'
          AND v.deleted_at IS NULL
          AND (${governorateId} IS NULL OR v.governorate_id = ${governorateId})
      )
      SELECT year,
             CAST(SUM(population) AS SIGNED) AS total_population,
             CAST(COUNT(*) AS SIGNED)        AS villages_count
      FROM ranked
      WHERE rn = 1
      GROUP BY year
      ORDER BY year
    `);

    return {
      governorate: name,
      basis: TRENDS_BASIS,
      // SUM/COUNT can come back as BigInt, which JSON cannot serialize.
      data: rows.map((r) => ({
        year: Number(r.year),
        totalPopulation: Number(r.total_population),
        villagesCount: Number(r.villages_count),
      })),
    };
  }
}
