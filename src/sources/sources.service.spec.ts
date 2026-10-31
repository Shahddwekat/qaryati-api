import 'reflect-metadata';
import { jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SourcesService } from './sources.service';
import { ListSourcesQueryDto } from './dto/list-sources-query.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const OWNER = { id: 3, email: 'c@x.org', role: 'CONTRIBUTOR' };
const OTHER = { id: 4, email: 'o@x.org', role: 'CONTRIBUTOR' };
const VERIFIER = { id: 2, email: 'v@x.org', role: 'VERIFIER' };

const sourceRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  type: 'BOOK',
  title: 'Palestine Census 1945',
  author: null,
  publisher: null,
  year: 1945,
  url: null,
  accessedAt: null,
  createdBy: OWNER.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const query = (over: Partial<ListSourcesQueryDto> = {}) =>
  Object.assign(new ListSourcesQueryDto(), over);

function setup() {
  const source = {
    findMany: mockFn().mockResolvedValue([]),
    count: mockFn().mockResolvedValue(0),
    findUnique: mockFn(),
    findFirst: mockFn().mockResolvedValue(null),
    create: mockFn(),
    update: mockFn(),
  };
  const tx = { source };
  const prisma = {
    source,
    $transaction: mockFn().mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as AnyFn)(tx),
    ),
  };
  const audit = { log: mockFn().mockResolvedValue({}) };
  const service = new SourcesService(prisma as never, audit as never);
  return { service, source, tx, audit };
}

describe('SourcesService', () => {
  describe('list', () => {
    it('paginates and returns meta', async () => {
      const { service, source } = setup();
      source.findMany.mockResolvedValue([sourceRow()]);
      source.count.mockResolvedValue(45);

      const result = await service.list(query({ page: 3, limit: 20 }));

      expect(source.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta).toEqual({
        page: 3,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('filters by type and searches title, author and publisher', async () => {
      const { service, source } = setup();
      await service.list(query({ type: 'CENSUS' as never, q: ' census ' }));
      const where = source.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        type: 'CENSUS',
        OR: [
          { title: { contains: 'census' } },
          { author: { contains: 'census' } },
          { publisher: { contains: 'census' } },
        ],
      });
      expect(source.count).toHaveBeenCalledWith({ where });
    });

    it('applies the requested sort with id as a stable tiebreaker', async () => {
      const { service, source } = setup();
      await service.list(query({ sortBy: 'year', order: 'asc' }));
      expect(source.findMany.mock.calls[0][0].orderBy).toEqual([
        { year: 'asc' },
        { id: 'asc' },
      ]);
    });
  });

  describe('findOne', () => {
    it('throws NotFound when missing', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(null);
      await expect(service.findOne(9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = {
      type: 'BOOK' as never,
      title: '  Village Book  ',
      year: 1990,
    };

    it('stores the creator, trims the title and audits in the same transaction', async () => {
      const { service, source, tx, audit } = setup();
      source.create.mockResolvedValue(
        sourceRow({ id: 7, title: 'Village Book' }),
      );

      await service.create(dto, OWNER, '1.2.3.4');

      expect(source.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Village Book',
          createdBy: OWNER.id,
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: OWNER.id,
          action: 'CREATE',
          entityType: 'source',
          entityId: 7,
          ipAddress: '1.2.3.4',
        }),
        tx,
      );
    });

    it('rejects a publication year in the future', async () => {
      const { service, source } = setup();
      const year = new Date().getFullYear() + 1;
      await expect(
        service.create({ ...dto, year }, OWNER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(source.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate (same type, title and year) with 409', async () => {
      const { service, source, audit } = setup();
      source.findFirst.mockResolvedValue({ id: 5 });
      await expect(service.create(dto, OWNER)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(source.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects an empty body', async () => {
      const { service } = setup();
      await expect(service.update(1, {}, OWNER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an empty body as ValidationPipe really builds it', async () => {
      // Regression: a real DTO instance has all fields present with value
      // undefined, so Object.keys() is never empty. A plain {} hid this bug.
      const { service, source, audit } = setup();
      const dto = plainToInstance(UpdateSourceDto, {});
      expect(Object.keys(dto).length).toBeGreaterThan(0);

      await expect(service.update(1, dto, OWNER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(source.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('accepts a real DTO with one field set', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(sourceRow());
      source.update.mockResolvedValue(sourceRow({ publisher: 'PCBS' }));
      const dto = plainToInstance(UpdateSourceDto, { publisher: 'PCBS' });
      await expect(service.update(1, dto, OWNER)).resolves.toBeDefined();
    });

    it('throws NotFound when the source does not exist', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(null);
      await expect(
        service.update(1, { title: 'x' }, OWNER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids a contributor who is not the creator', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(sourceRow());
      await expect(
        service.update(1, { title: 'New' }, OTHER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(source.update).not.toHaveBeenCalled();
    });

    it('lets the creator edit and audits before/after', async () => {
      const { service, source, tx, audit } = setup();
      const before = sourceRow();
      source.findUnique.mockResolvedValue(before);
      source.update.mockResolvedValue({ ...before, publisher: 'PCBS' });

      await service.update(1, { publisher: 'PCBS' }, OWNER);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entityId: 1,
          beforeData: expect.objectContaining({ publisher: null }),
          afterData: expect.objectContaining({ publisher: 'PCBS' }),
        }),
        tx,
      );
    });

    it('lets a VERIFIER edit a source created by someone else', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(sourceRow());
      source.update.mockResolvedValue(sourceRow());
      await expect(
        service.update(1, { author: 'A. Author' }, VERIFIER),
      ).resolves.toBeDefined();
    });

    it('checks duplicates against OTHER sources only', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(sourceRow());
      source.update.mockResolvedValue(sourceRow());
      await service.update(1, { title: 'Renamed' }, OWNER);
      expect(source.findFirst.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ id: { not: 1 }, title: 'Renamed' }),
      );
    });

    it('conflicts when the new title collides with another source', async () => {
      const { service, source } = setup();
      source.findUnique.mockResolvedValue(sourceRow());
      source.findFirst.mockResolvedValue({ id: 8 });
      await expect(
        service.update(1, { title: 'Taken' }, OWNER),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
