import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { VillageFactsService } from './village-facts.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const USER = { id: 3, email: 'c@x.org', role: 'CONTRIBUTOR' };

function setup() {
  const villageName = {
    findMany: mockFn().mockResolvedValue([]),
    create: mockFn().mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 40, status: 'PENDING', ...data }),
    ),
  };
  const villageRelation = {
    findMany: mockFn().mockResolvedValue([]),
    findFirst: mockFn().mockResolvedValue(null),
    create: mockFn().mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 7, status: 'PENDING', ...data }),
    ),
  };
  const tx = { villageName, villageRelation };
  const prisma = {
    village: { findFirst: mockFn().mockResolvedValue({ id: 1 }) },
    source: { findUnique: mockFn().mockResolvedValue({ id: 1 }) },
    villageName,
    villageRelation,
    $transaction: mockFn().mockImplementation((fn: AnyFn) => fn(tx)),
  };
  const audit = { log: mockFn().mockResolvedValue({}) };
  return {
    service: new VillageFactsService(prisma as never, audit as never),
    prisma,
    villageName,
    villageRelation,
    audit,
  };
}

const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });

describe('VillageFactsService names', () => {
  const historical = {
    name: '  Samaria ',
    language: 'EN' as const,
    type: 'HISTORICAL' as const,
    periodNote: 'Roman era',
    sourceId: 1,
  };

  it('adds a name as PENDING, trimmed, with an audit row', async () => {
    const { service, villageName, audit } = setup();

    const created = await service.addName(1, historical, USER, '1.1.1.1');

    const data = villageName.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Samaria', submittedById: 3 });
    expect(data.status).toBeUndefined(); // database default: PENDING
    expect(created.status).toBe('PENDING');
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'CREATE',
      entityType: 'village_name',
      entityId: 40,
    });
  });

  it('requires a source for a historical name, but not for a transliteration', async () => {
    const { service, villageName } = setup();

    await expect(
      service.addName(1, { ...historical, sourceId: undefined }, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(villageName.create).not.toHaveBeenCalled();

    await service.addName(
      1,
      { name: 'Sabastiya', language: 'EN', type: 'TRANSLITERATION' },
      USER,
    );
    expect(villageName.create).toHaveBeenCalledTimes(1);
  });

  it('returns 409 for the same name and type twice', async () => {
    const { service, villageName } = setup();
    villageName.create.mockRejectedValue(p2002);

    await expect(service.addName(1, historical, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns 404 for a hidden village and an unknown source', async () => {
    const { service, prisma } = setup();
    prisma.village.findFirst.mockResolvedValueOnce(null);
    await expect(service.addName(1, historical, USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.source.findUnique.mockResolvedValueOnce(null);
    await expect(service.addName(1, historical, USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists names without REJECTED ones, preferred first', async () => {
    const { service, villageName } = setup();
    villageName.findMany.mockResolvedValue([{ id: 1, isPreferred: null }]);

    const names = await service.listNames(1);

    const args = villageName.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ villageId: 1, status: { not: 'REJECTED' } });
    expect(args.orderBy).toEqual([
      { type: 'asc' },
      { isPreferred: 'desc' },
      { id: 'asc' },
    ]);
    expect(names[0].isPreferred).toBe(false);
  });
});

describe('VillageFactsService relations', () => {
  const split = {
    relatedVillageId: 1,
    type: 'SPLIT_FROM' as const,
    year: 1965,
    sourceId: 1,
  };

  it('adds a relation as PENDING with an audit row', async () => {
    const { service, villageRelation, audit } = setup();

    await service.addRelation(3, split, USER);

    expect(villageRelation.create.mock.calls[0][0].data).toMatchObject({
      villageId: 3,
      relatedVillageId: 1,
      type: 'SPLIT_FROM',
      year: 1965,
    });
    expect(audit.log.mock.calls[0][0].entityType).toBe('village_relation');
  });

  it('rejects a relation to the village itself', async () => {
    const { service, prisma } = setup();
    await expect(service.addRelation(1, split, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.village.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['a future year', 2999],
    ['a year before 1000', 999],
  ])('rejects %s', async (_name, year) => {
    const { service } = setup();
    await expect(
      service.addRelation(3, { ...split, year }, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 when the opposite relation already exists', async () => {
    const { service, villageRelation } = setup();
    villageRelation.findFirst.mockResolvedValue({ id: 5 });

    await expect(service.addRelation(3, split, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(villageRelation.findFirst.mock.calls[0][0].where).toMatchObject({
      villageId: 1,
      relatedVillageId: 3,
      type: 'SPLIT_FROM',
    });
    expect(villageRelation.create).not.toHaveBeenCalled();
  });

  it('returns 409 for the same relation twice', async () => {
    const { service, villageRelation } = setup();
    villageRelation.create.mockRejectedValue(p2002);

    await expect(service.addRelation(3, split, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lists relations in both directions, with the other village', async () => {
    const { service, villageRelation } = setup();
    const other = { id: 3, nameAr: 'كفر قدوم', nameEn: 'Kafr Qaddum' };
    villageRelation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 7, type: 'SPLIT_FROM', village: other }]);

    const relations = await service.listRelations(1);

    expect(relations).toEqual([
      {
        id: 7,
        type: 'SPLIT_FROM',
        direction: 'INCOMING',
        otherVillage: other,
      },
    ]);
    const [outgoing, incoming] = villageRelation.findMany.mock.calls.map(
      (c) => c[0].where,
    );
    expect(outgoing).toMatchObject({
      villageId: 1,
      relatedVillage: { deletedAt: null },
    });
    expect(incoming).toMatchObject({
      relatedVillageId: 1,
      village: { deletedAt: null },
    });
  });
});
