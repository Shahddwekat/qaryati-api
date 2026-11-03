import 'reflect-metadata';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { ListVillagesQueryDto } from './dto/list-villages-query.dto';
import { VillagesService } from './villages.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const villageRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  nameAr: 'سبسطية',
  nameEn: 'Sebastia',
  latitude: new Prisma.Decimal('32.276400'),
  longitude: new Prisma.Decimal('35.195800'),
  governorate: { id: 4, nameAr: 'نابلس', nameEn: 'Nablus' },
  municipality: null,
  ...over,
});

const query = (over: Partial<ListVillagesQueryDto> = {}) =>
  Object.assign(new ListVillagesQueryDto(), over);

function setup() {
  const village = {
    findMany: mockFn().mockResolvedValue([]),
    count: mockFn().mockResolvedValue(0),
    findFirst: mockFn().mockResolvedValue(null),
  };
  const prisma = {
    village,
    // Array form of $transaction: resolve every query in the array.
    $transaction: mockFn().mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    ),
  };
  return { service: new VillagesService(prisma as never), village };
}

describe('VillagesService.list', () => {
  it('hides soft-deleted villages and paginates', async () => {
    const { service, village } = setup();
    village.findMany.mockResolvedValue([villageRow()]);
    village.count.mockResolvedValue(21);

    const page = await service.list(query({ page: 2, limit: 10 }));

    const args = village.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ deletedAt: null });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(page.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  it('filters by governorate and municipality', async () => {
    const { service, village } = setup();
    await service.list(query({ governorateId: 4, municipalityId: 7 }));

    const where = { deletedAt: null, governorateId: 4, municipalityId: 7 };
    expect(village.findMany.mock.calls[0][0].where).toEqual(where);
    expect(village.count.mock.calls[0][0].where).toEqual(where);
  });

  it('sorts by the requested field, with id as a stable tie-breaker', async () => {
    const { service, village } = setup();
    await service.list(query({ sortBy: 'nameAr', order: 'desc' }));

    expect(village.findMany.mock.calls[0][0].orderBy).toEqual([
      { nameAr: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('returns coordinates as plain numbers', async () => {
    const { service, village } = setup();
    village.findMany.mockResolvedValue([villageRow()]);
    village.count.mockResolvedValue(1);

    const page = await service.list(query());

    expect(page.data[0]).toMatchObject({
      latitude: 32.2764,
      longitude: 35.1958,
    });
  });
});

describe('VillagesService.findOne', () => {
  it('returns 404 for a missing or hidden village', async () => {
    const { service, village } = setup();
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
    expect(village.findFirst.mock.calls[0][0].where).toEqual({
      id: 99,
      deletedAt: null,
    });
  });

  it('only includes names that are not REJECTED', async () => {
    const { service, village } = setup();
    village.findFirst.mockResolvedValue({
      ...villageRow(),
      nameOrigin: null,
      locationDescription: null,
      elevationM: null,
      areaDunum: new Prisma.Decimal('1250.50'),
      names: [{ id: 1, name: 'سبسطية', isPreferred: null }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const detail = await service.findOne(1);

    const select = village.findFirst.mock.calls[0][0].select;
    expect(select.names.where).toEqual({ status: { not: 'REJECTED' } });
    expect(detail.areaDunum).toBe(1250.5);
    expect(detail.names[0].isPreferred).toBe(false);
  });
});

describe('ListVillagesQueryDto', () => {
  const errorsOf = async (plain: object) =>
    (await validate(plainToInstance(ListVillagesQueryDto, plain))).map(
      (e) => e.property,
    );

  it('defaults to sorting by English name, ascending', () => {
    expect(plainToInstance(ListVillagesQueryDto, {})).toMatchObject({
      sortBy: 'nameEn',
      order: 'asc',
      page: 1,
      limit: 20,
    });
  });

  it.each([
    ['unknown sort field', { sortBy: 'deletedAt' }, 'sortBy'],
    ['unknown order', { order: 'up' }, 'order'],
    ['governorateId 0', { governorateId: '0' }, 'governorateId'],
    ['text municipalityId', { municipalityId: 'x' }, 'municipalityId'],
    ['limit above 100', { limit: '500' }, 'limit'],
  ])('rejects %s', async (_name, plain, property) => {
    expect(await errorsOf(plain)).toContain(property);
  });
});
