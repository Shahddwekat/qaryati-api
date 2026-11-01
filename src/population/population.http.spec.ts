import 'reflect-metadata';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePopulationDto } from './dto/create-population.dto';
import { PopulationReportsService } from './population-reports.service';
import { PopulationReviewController } from './population-review.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const errorsOf = async (plain: object) =>
  (
    await validate(plainToInstance(CreatePopulationDto, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('CreatePopulationDto', () => {
  const valid = { year: 1997, population: 1200, sourceId: 1 };

  it('accepts a minimal body and one with optional fields', async () => {
    expect(await errorsOf(valid)).toEqual([]);
    expect(
      await errorsOf({ ...valid, households: 200, notes: 'PCBS' }),
    ).toEqual([]);
  });

  it.each([
    ['missing sourceId', { year: 1997, population: 10 }, 'sourceId'],
    ['missing year', { population: 10, sourceId: 1 }, 'year'],
    ['negative population', { ...valid, population: -5 }, 'population'],
    ['fractional population', { ...valid, population: 10.5 }, 'population'],
    ['text year', { ...valid, year: 'abc' }, 'year'],
    ['sourceId zero', { ...valid, sourceId: 0 }, 'sourceId'],
    ['negative households', { ...valid, households: -1 }, 'households'],
    ['status in body', { ...valid, status: 'VERIFIED' }, 'status'],
    ['isPreferred in body', { ...valid, isPreferred: true }, 'isPreferred'],
    ['submittedById in body', { ...valid, submittedById: 1 }, 'submittedById'],
  ])('rejects %s', async (_name, body, property) => {
    expect(await errorsOf(body)).toContain(property);
  });
});

describe('PopulationReviewController', () => {
  const user = { id: 2, email: 'v@x.org', role: 'VERIFIER' };
  const verification = {
    verify: mockFn().mockResolvedValue({}),
    reject: mockFn().mockResolvedValue({}),
    prefer: mockFn().mockResolvedValue({}),
  };
  const controller = new PopulationReviewController(verification as never);

  it('delegates verify, reject and prefer to VerificationService for population records', async () => {
    await controller.verify(4, user, '1.1.1.1');
    await controller.reject(4, { reason: 'Wrong year' }, user, '1.1.1.1');
    await controller.prefer(4, user, '1.1.1.1');

    expect(verification.verify).toHaveBeenCalledWith(
      'population_record',
      4,
      user,
      '1.1.1.1',
    );
    expect(verification.reject).toHaveBeenCalledWith(
      'population_record',
      4,
      user,
      'Wrong year',
      '1.1.1.1',
    );
    expect(verification.prefer).toHaveBeenCalledWith(
      'population_record',
      4,
      user,
      '1.1.1.1',
    );
  });
});

describe('PopulationReportsService', () => {
  function setup(rows: unknown[] = []) {
    const prisma = {
      governorate: { findFirst: mockFn().mockResolvedValue({ id: 7 }) },
      $queryRaw: mockFn().mockResolvedValue(rows),
    };
    return { prisma, service: new PopulationReportsService(prisma as never) };
  }

  it('without a governorate it looks nothing up and passes NULL filters', async () => {
    const { service, prisma } = setup();
    const result = await service.trends();
    expect(prisma.governorate.findFirst).not.toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.calls[0][0].values).toEqual([null, null]);
    expect(result.governorate).toBeNull();
  });

  it('resolves the governorate by English or Arabic name', async () => {
    const { service, prisma } = setup();
    await service.trends('  Ramallah ');
    expect(prisma.governorate.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ nameEn: 'Ramallah' }, { nameAr: 'Ramallah' }] },
      select: { id: true },
    });
    expect(prisma.$queryRaw.mock.calls[0][0].values).toEqual([7, 7]);
  });

  it('treats a blank governorate as "all"', async () => {
    const { service, prisma } = setup();
    await service.trends('   ');
    expect(prisma.governorate.findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown governorate instead of an empty report', async () => {
    const { service, prisma } = setup();
    prisma.governorate.findFirst.mockResolvedValue(null);
    await expect(service.trends('Atlantis')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('converts BigInt results so the response can be serialized', async () => {
    const { service } = setup([
      { year: 1997, total_population: 2250n, villages_count: 3n },
      { year: 2007, total_population: 1300n, villages_count: 1n },
    ]);
    const result = await service.trends();
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.data).toEqual([
      { year: 1997, totalPopulation: 2250, villagesCount: 3 },
      { year: 2007, totalPopulation: 1300, villagesCount: 1 },
    ]);
    expect(result.basis).toMatch(/one verified figure per village and year/i);
  });

  it('only sums VERIFIED figures of visible villages, one per village and year', async () => {
    const { service, prisma } = setup();
    await service.trends();
    const sql = prisma.$queryRaw.mock.calls[0][0].sql as string;
    expect(sql).toContain("pr.status = 'VERIFIED'");
    expect(sql).toContain('v.deleted_at IS NULL');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('WHERE rn = 1');
  });
});
