import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PopulationService } from './population.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const USER = { id: 3, email: 'c@x.org', role: 'CONTRIBUTOR' };
const source = { id: 1, title: 'Census 1997', type: 'CENSUS' };

const rec = (over: Record<string, unknown> = {}) => ({
  id: 1,
  villageId: 5,
  year: 1997,
  population: 1000,
  households: null,
  notes: null,
  sourceId: 1,
  status: 'VERIFIED',
  isPreferred: null,
  verifiedAt: null,
  createdAt: new Date('2026-01-01'),
  source,
  ...over,
});

function setup() {
  const populationRecord = {
    findMany: mockFn().mockResolvedValue([]),
    create: mockFn(),
  };
  const tx = { populationRecord };
  const prisma = {
    village: { findFirst: mockFn().mockResolvedValue({ id: 5 }) },
    source: { findUnique: mockFn().mockResolvedValue({ id: 1 }) },
    populationRecord,
    $transaction: mockFn().mockImplementation((cb: AnyFn) => cb(tx)),
  };
  const audit = { log: mockFn().mockResolvedValue({}) };
  const service = new PopulationService(prisma as never, audit as never);
  return { service, prisma, populationRecord, tx, audit };
}

describe('PopulationService.listByVillage', () => {
  it('answers 404 for a missing or hidden village', async () => {
    const { service, prisma } = setup();
    prisma.village.findFirst.mockResolvedValue(null);
    await expect(service.listByVillage(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.village.findFirst).toHaveBeenCalledWith({
      where: { id: 99, deletedAt: null },
      select: { id: true },
    });
  });

  it('never asks for rejected records', async () => {
    const { service, populationRecord } = setup();
    await service.listByVillage(5);
    expect(populationRecord.findMany.mock.calls[0][0].where).toEqual({
      villageId: 5,
      status: { not: 'REJECTED' },
    });
  });

  it('groups by year with the preferred figure first and alternatives after', async () => {
    const { service, populationRecord } = setup();
    populationRecord.findMany.mockResolvedValue([
      rec({ id: 9, year: 2007, population: 1300, isPreferred: true }),
      rec({ id: 5, year: 1997, population: 1100, status: 'PENDING' }),
      rec({ id: 3, year: 1997, population: 1000, isPreferred: true }),
      rec({ id: 4, year: 1997, population: 1050 }),
    ]);

    const result = await service.listByVillage(5);

    expect(result.map((y) => y.year)).toEqual([2007, 1997]);
    const y1997 = result[1];
    expect(y1997.preferred).toMatchObject({
      id: 3,
      population: 1000,
      isPreferred: true,
    });
    // VERIFIED alternative before the PENDING one
    expect(y1997.alternatives.map((a) => a.id)).toEqual([4, 5]);
    expect(y1997.alternatives[1].status).toBe('PENDING');
    expect(y1997.alternatives[0].isPreferred).toBe(false);
  });

  it('gives preferred = null when a year has no preferred figure yet', async () => {
    const { service, populationRecord } = setup();
    populationRecord.findMany.mockResolvedValue([rec({ id: 1 })]);
    const [year] = await service.listByVillage(5);
    expect(year.preferred).toBeNull();
    expect(year.alternatives).toHaveLength(1);
  });

  it('includes the source of every figure', async () => {
    const { service, populationRecord } = setup();
    populationRecord.findMany.mockResolvedValue([rec()]);
    const [year] = await service.listByVillage(5);
    expect(year.alternatives[0].source).toEqual(source);
  });
});

describe('PopulationService.create', () => {
  const dto = { year: 1997, population: 1200, households: 200, sourceId: 1 };

  it('rejects invalid input before touching the database', async () => {
    const { service, prisma } = setup();
    const error = await service
      .create(5, { ...dto, year: 2999 }, USER)
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse().message[0]).toMatch(/year must be between/);
    expect(prisma.village.findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 when the village does not exist', async () => {
    const { service, prisma } = setup();
    prisma.village.findFirst.mockResolvedValue(null);
    await expect(service.create(5, dto, USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 404 when the source does not exist', async () => {
    const { service, prisma, populationRecord } = setup();
    prisma.source.findUnique.mockResolvedValue(null);
    await expect(service.create(5, dto, USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(populationRecord.create).not.toHaveBeenCalled();
  });

  it('stores the submitter, leaves the status to the PENDING default and audits CREATE', async () => {
    const { service, populationRecord, tx, audit } = setup();
    populationRecord.create.mockResolvedValue(
      rec({ id: 20, status: 'PENDING', population: 1200, households: 200 }),
    );

    const result = await service.create(5, dto, USER, '9.9.9.9');

    const data = populationRecord.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ villageId: 5, submittedById: 3, sourceId: 1 });
    expect(data).not.toHaveProperty('status'); // cannot self-verify
    expect(data).not.toHaveProperty('isPreferred');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        action: 'CREATE',
        entityType: 'population_record',
        entityId: 20,
        ipAddress: '9.9.9.9',
      }),
      tx,
    );
    expect(result.warnings).toEqual([]);
    expect(result.record.id).toBe(20);
  });

  it('accepts 0 population', async () => {
    const { service, populationRecord } = setup();
    populationRecord.create.mockResolvedValue(rec({ id: 21, population: 0 }));
    await expect(
      service.create(5, { year: 1949, population: 0, sourceId: 1 }, USER),
    ).resolves.toBeDefined();
  });

  it('returns a warning (not an error) for an implausible jump', async () => {
    const { service, populationRecord } = setup();
    populationRecord.findMany.mockResolvedValue([
      { id: 1, year: 1997, population: 1000, isPreferred: null },
    ]);
    populationRecord.create.mockResolvedValue(rec({ id: 22 }));

    const result = await service.create(
      5,
      { year: 2007, population: 50000, sourceId: 1 },
      USER,
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Please check the source/);
  });

  it('only compares with VERIFIED figures', async () => {
    const { service, populationRecord } = setup();
    populationRecord.create.mockResolvedValue(rec());
    await service.create(5, dto, USER);
    expect(populationRecord.findMany.mock.calls[0][0].where).toEqual({
      villageId: 5,
      status: 'VERIFIED',
    });
  });

  it('turns a duplicate (same village, year and source) into 409', async () => {
    const { service, populationRecord } = setup();
    populationRecord.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create(5, dto, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lets a different source give another figure for the same year', async () => {
    const { service, populationRecord } = setup();
    populationRecord.create.mockResolvedValue(rec({ id: 30, sourceId: 2 }));
    await expect(
      service.create(5, { ...dto, sourceId: 2 }, USER),
    ).resolves.toBeDefined();
  });
});
