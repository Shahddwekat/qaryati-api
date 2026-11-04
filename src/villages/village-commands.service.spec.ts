import 'reflect-metadata';
import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '../generated/prisma/client';
import { UpdateVillageDto } from './dto/update-village.dto';
import {
  VillageCommandsService,
  assertCoordinatesTogether,
  isInPalestine,
} from './village-commands.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const VERIFIER = { id: 2, email: 'v@x.org', role: 'VERIFIER' };
const ADMIN = { id: 1, email: 'a@x.org', role: 'ADMIN' };

const villageRow = (over: Record<string, unknown> = {}) => ({
  id: 7,
  nameAr: 'عين قينيا',
  nameEn: 'Ein Qiniya',
  governorateId: 7,
  municipalityId: null,
  latitude: new Prisma.Decimal('31.930000'),
  longitude: new Prisma.Decimal('35.160000'),
  nameOrigin: null,
  locationDescription: null,
  elevationM: null,
  areaDunum: null,
  deletedAt: null,
  ...over,
});

const createDto = (over: Record<string, unknown> = {}) => ({
  nameAr: 'عين قينيا',
  nameEn: 'Ein Qiniya',
  governorateId: 7,
  latitude: 31.93,
  longitude: 35.16,
  ...over,
});

function setup() {
  const village = {
    create: mockFn().mockResolvedValue(villageRow()),
    update: mockFn().mockResolvedValue(villageRow()),
    updateMany: mockFn().mockResolvedValue({ count: 1 }),
    findFirst: mockFn().mockResolvedValue(null),
    findUnique: mockFn().mockResolvedValue(null),
  };
  const villageName = {
    createMany: mockFn().mockResolvedValue({ count: 2 }),
    create: mockFn().mockResolvedValue({}),
    findUnique: mockFn().mockResolvedValue(null),
  };
  const tx = { village, villageName };
  const prisma = {
    village,
    villageName,
    governorate: {
      findUnique: mockFn().mockResolvedValue({ id: 7, nameEn: 'Ramallah' }),
    },
    municipality: { findUnique: mockFn().mockResolvedValue(null) },
    $transaction: mockFn().mockImplementation((fn: AnyFn) => fn(tx)),
  };
  const audit = { log: mockFn().mockResolvedValue({}) };
  const geocoding = { geocode: mockFn() };
  const villages = { findOne: mockFn().mockResolvedValue({ id: 7 }) };

  const service = new VillageCommandsService(
    prisma as never,
    audit as never,
    geocoding as never,
    villages as never,
  );
  return { service, prisma, village, villageName, audit, geocoding };
}

describe('VillageCommandsService.create', () => {
  it('creates the village, its two official names and an audit row in one transaction', async () => {
    const { service, prisma, village, villageName, audit, geocoding } = setup();

    await service.create(createDto() as never, VERIFIER, '1.1.1.1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(village.create.mock.calls[0][0].data).toMatchObject({
      nameAr: 'عين قينيا',
      latitude: 31.93,
      longitude: 35.16,
    });
    const names = villageName.createMany.mock.calls[0][0].data;
    expect(names.map((n: { type: string }) => n.type)).toEqual([
      'CURRENT',
      'ENGLISH',
    ]);
    // No status given: names start PENDING so another verifier reviews them.
    expect(names[0].status).toBeUndefined();
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'CREATE',
      entityType: 'village',
      entityId: 7,
      userId: 2,
    });
    expect(geocoding.geocode).not.toHaveBeenCalled();
  });

  it('geocodes the village when no coordinates are given', async () => {
    const { service, village, geocoding } = setup();
    geocoding.geocode.mockResolvedValue({
      latitude: 31.9012345678,
      longitude: 35.1612345678,
      displayName: 'Deir Ghassana',
    });

    await service.create(
      createDto({ latitude: undefined, longitude: undefined }) as never,
      VERIFIER,
    );

    expect(geocoding.geocode).toHaveBeenCalledWith(
      'Ein Qiniya, Ramallah, Palestine',
    );
    expect(village.create.mock.calls[0][0].data).toMatchObject({
      latitude: 31.901235,
      longitude: 35.161235,
    });
  });

  it('returns 422 when geocoding finds nothing', async () => {
    const { service, geocoding, village } = setup();
    geocoding.geocode.mockResolvedValue(null);

    await expect(
      service.create(
        createDto({ latitude: undefined, longitude: undefined }) as never,
        VERIFIER,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(village.create).not.toHaveBeenCalled();
  });

  it('returns 422 when geocoding finds a place outside Palestine', async () => {
    const { service, geocoding } = setup();
    geocoding.geocode.mockResolvedValue({
      latitude: 40.7,
      longitude: -74,
      displayName: 'New York',
    });

    await expect(
      service.create(
        createDto({ latitude: undefined, longitude: undefined }) as never,
        VERIFIER,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('returns 503 when the geocoding provider is down', async () => {
    const { service, geocoding } = setup();
    geocoding.geocode.mockRejectedValue(new Error('timeout'));

    await expect(
      service.create(
        createDto({ latitude: undefined, longitude: undefined }) as never,
        VERIFIER,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects an unknown governorate', async () => {
    const { service, prisma } = setup();
    prisma.governorate.findUnique.mockResolvedValue(null);

    await expect(
      service.create(createDto() as never, VERIFIER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a municipality of another governorate', async () => {
    const { service, prisma } = setup();
    prisma.municipality.findUnique.mockResolvedValue({ governorateId: 4 });

    await expect(
      service.create(createDto({ municipalityId: 3 }) as never, VERIFIER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second visible village with the same Arabic name in the governorate', async () => {
    const { service, village } = setup();
    village.findFirst.mockResolvedValue({ id: 3 });

    await expect(
      service.create(createDto() as never, VERIFIER),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(village.findFirst.mock.calls[0][0].where).toMatchObject({
      governorateId: 7,
      nameAr: 'عين قينيا',
      deletedAt: null,
    });
  });
});

describe('VillageCommandsService.update', () => {
  it('rejects an empty body as ValidationPipe builds it', async () => {
    const { service, village } = setup();
    const dto = plainToInstance(UpdateVillageDto, {});
    expect(Object.keys(dto).length).toBeGreaterThan(0);

    await expect(service.update(7, dto, VERIFIER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(village.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a hidden or missing village', async () => {
    const { service } = setup();
    await expect(
      service.update(7, { nameEn: 'X' }, VERIFIER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates, adds the new name as PENDING and audits before/after', async () => {
    const { service, village, villageName, audit } = setup();
    village.findFirst
      .mockResolvedValueOnce(villageRow()) // the village itself
      .mockResolvedValue(null); // no duplicate
    village.update.mockResolvedValue(villageRow({ nameEn: 'Ein Qinya' }));

    await service.update(7, { nameEn: 'Ein Qinya' }, VERIFIER, '1.1.1.1');

    expect(villageName.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Ein Qinya', type: 'ENGLISH' }),
    });
    const entry = audit.log.mock.calls[0][0];
    expect(entry.action).toBe('UPDATE');
    expect(entry.beforeData.nameEn).toBe('Ein Qiniya');
    expect(entry.afterData.nameEn).toBe('Ein Qinya');
  });

  it('drops the old municipality when moving to another governorate', async () => {
    const { service, village } = setup();
    village.findFirst
      .mockResolvedValueOnce(villageRow({ municipalityId: 5 }))
      .mockResolvedValue(null);

    await service.update(7, { governorateId: 4 }, VERIFIER);

    expect(village.update.mock.calls[0][0].data).toMatchObject({
      governorateId: 4,
      municipalityId: null,
    });
  });
});

describe('VillageCommandsService.hide / restore', () => {
  it('hides a visible village and audits DELETE', async () => {
    const { service, village, audit } = setup();
    village.findFirst.mockResolvedValue(villageRow());

    const result = await service.hide(7, ADMIN);

    expect(village.updateMany.mock.calls[0][0].where).toEqual({
      id: 7,
      deletedAt: null,
    });
    expect(result.id).toBe(7);
    expect(audit.log.mock.calls[0][0].action).toBe('DELETE');
  });

  it('returns 404 when the village is already hidden', async () => {
    const { service } = setup();
    await expect(service.hide(7, ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('restores a hidden village and audits RESTORE', async () => {
    const { service, village, audit } = setup();
    village.findUnique.mockResolvedValue(
      villageRow({ deletedAt: new Date('2026-01-01') }),
    );

    await service.restore(7, ADMIN);

    expect(village.updateMany.mock.calls[0][0].data).toEqual({
      deletedAt: null,
    });
    expect(audit.log.mock.calls[0][0].action).toBe('RESTORE');
  });

  it('returns 409 when restoring a village that is not hidden', async () => {
    const { service, village } = setup();
    village.findUnique.mockResolvedValue(villageRow());

    await expect(service.restore(7, ADMIN)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to restore when another visible village now has the same name', async () => {
    const { service, village } = setup();
    village.findUnique.mockResolvedValue(
      villageRow({ deletedAt: new Date('2026-01-01') }),
    );
    village.findFirst.mockResolvedValue({ id: 9 });

    await expect(service.restore(7, ADMIN)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('helpers', () => {
  it('accepts both coordinates or neither, never only one', () => {
    expect(() => assertCoordinatesTogether(31.9, 35.2)).not.toThrow();
    expect(() => assertCoordinatesTogether(undefined, undefined)).not.toThrow();
    expect(() => assertCoordinatesTogether(31.9, undefined)).toThrow(
      BadRequestException,
    );
    expect(() => assertCoordinatesTogether(undefined, 35.2)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    ['Ramallah', 31.9, 35.2, true],
    ['Gaza', 31.5, 34.46, true],
    ['Haifa (historic Palestine)', 32.8, 35.0, true],
    ['Amman', 31.95, 35.93, false],
    ['New York', 40.7, -74, false],
  ])('isInPalestine: %s', (_name, lat, lng, expected) => {
    expect(isInPalestine(lat, lng)).toBe(expected);
  });
});
