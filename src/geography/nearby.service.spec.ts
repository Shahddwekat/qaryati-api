import 'reflect-metadata';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { NearbyService } from './nearby.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

function setup() {
  const prisma = {
    village: { findFirst: mockFn().mockResolvedValue(null) },
    $queryRaw: mockFn().mockResolvedValue([]),
  };
  return { service: new NearbyService(prisma as never), prisma };
}

const query = (over: Partial<NearbyQueryDto> = {}) =>
  Object.assign(new NearbyQueryDto(), over);

describe('NearbyService', () => {
  it('returns 404 for a missing or hidden village, without running the SQL', async () => {
    const { service, prisma } = setup();

    await expect(service.nearby(99, query())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.village.findFirst.mock.calls[0][0].where).toEqual({
      id: 99,
      deletedAt: null,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('maps rows to numbers and rounds the distance to 10 m', async () => {
    const { service, prisma } = setup();
    prisma.village.findFirst.mockResolvedValue({
      id: 1,
      nameAr: 'سبسطية',
      nameEn: 'Sebastia',
      latitude: new Prisma.Decimal('32.276400'),
      longitude: new Prisma.Decimal('35.195800'),
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: BigInt(2),
        name_ar: 'برقة',
        name_en: 'Burqa',
        governorate_id: BigInt(4),
        latitude: '32.300600',
        longitude: '35.189700',
        distance_m: 2749.6,
      },
    ]);

    const result = await service.nearby(1, query({ radiusKm: 10 }));

    expect(result.village).toEqual({
      id: 1,
      nameAr: 'سبسطية',
      nameEn: 'Sebastia',
    });
    expect(result.data).toEqual([
      {
        id: 2,
        nameAr: 'برقة',
        nameEn: 'Burqa',
        governorateId: 4,
        latitude: 32.3006,
        longitude: 35.1897,
        distanceKm: 2.75,
      },
    ]);
  });

  it('passes the radius in metres and the bounding box to the SQL', async () => {
    const { service, prisma } = setup();
    prisma.village.findFirst.mockResolvedValue({
      id: 1,
      nameAr: 'x',
      nameEn: 'x',
      latitude: new Prisma.Decimal('32'),
      longitude: new Prisma.Decimal('35'),
    });

    await service.nearby(1, query({ radiusKm: 5, limit: 3 }));

    const sql = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain('ST_Distance_Sphere');
    expect(sql.sql).toContain('latitude BETWEEN');
    expect(sql.values).toEqual(expect.arrayContaining([5000, 3, 1]));
  });
});

describe('NearbyQueryDto', () => {
  const errorsOf = async (plain: object) =>
    (await validate(plainToInstance(NearbyQueryDto, plain))).map(
      (e) => e.property,
    );

  it('defaults to 10 km and 10 results', () => {
    expect(plainToInstance(NearbyQueryDto, {})).toMatchObject({
      radiusKm: 10,
      limit: 10,
    });
  });

  it.each([
    ['radius above 50 km', { radiusKm: '51' }, 'radiusKm'],
    ['radius 0', { radiusKm: '0' }, 'radiusKm'],
    ['text radius', { radiusKm: 'far' }, 'radiusKm'],
    ['limit above 50', { limit: '51' }, 'limit'],
  ])('rejects %s', async (_name, plain, property) => {
    expect(await errorsOf(plain)).toContain(property);
  });
});
