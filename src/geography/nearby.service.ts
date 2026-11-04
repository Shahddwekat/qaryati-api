import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { boundingBox } from './bounding-box';
import { NearbyQueryDto } from './dto/nearby-query.dto';

interface NearbyRow {
  id: number | bigint;
  name_ar: string;
  name_en: string;
  governorate_id: number | bigint;
  latitude: Prisma.Decimal | string | number;
  longitude: Prisma.Decimal | string | number;
  distance_m: number;
}

@Injectable()
export class NearbyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Visible villages within `radiusKm` of a village, nearest first (ADR-0006):
   * a bounding box on the (latitude, longitude) index narrows the candidates,
   * then ST_Distance_Sphere gives the exact great-circle distance. Native SQL,
   * because Prisma has no spatial functions.
   */
  async nearby(villageId: number, query: NearbyQueryDto) {
    const centre = await this.prisma.village.findFirst({
      where: { id: villageId, deletedAt: null },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!centre) {
      throw new NotFoundException(`Village #${villageId} not found`);
    }

    const lat = Number(centre.latitude);
    const lng = Number(centre.longitude);
    const box = boundingBox(lat, lng, query.radiusKm);

    const rows = await this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT v.id, v.name_ar, v.name_en, v.governorate_id, v.latitude, v.longitude,
             ST_Distance_Sphere(POINT(v.longitude, v.latitude), POINT(${lng}, ${lat})) AS distance_m
      FROM villages v
      WHERE v.deleted_at IS NULL
        AND v.id <> ${villageId}
        AND v.latitude BETWEEN ${box.minLat} AND ${box.maxLat}
        AND v.longitude BETWEEN ${box.minLng} AND ${box.maxLng}
      HAVING distance_m <= ${query.radiusKm * 1000}
      ORDER BY distance_m ASC, v.id ASC
      LIMIT ${query.limit}
    `);

    return {
      village: { id: centre.id, nameAr: centre.nameAr, nameEn: centre.nameEn },
      radiusKm: query.radiusKm,
      data: rows.map((r) => ({
        id: Number(r.id),
        nameAr: r.name_ar,
        nameEn: r.name_en,
        governorateId: Number(r.governorate_id),
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        distanceKm: Math.round(Number(r.distance_m) / 10) / 100,
      })),
    };
  }
}
