import { AuditService } from '../audit/audit.service';
import {
  LandmarkType,
  VerificationStatus,
  EventCategory,
  DatePrecision,
  CulturalCategory,
  EconomicType,
  Importance,
  FacilityType,
  AuditAction,
  FacilityStatus,
} from '../generated/prisma/client';
import { jest } from '@jest/globals';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HeritageService } from './heritage.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HeritageService', () => {
  let service: HeritageService;
  let auditMock: {
    log: jest.Mock<() => Promise<{ id: string }>>;
  };

  const prismaMock = {
    village: {
      findUnique: jest.fn<() => Promise<{ id: number } | null>>(),
      findFirst: jest.fn<() => Promise<{ id: number } | null>>(),
      findMany: jest.fn(),
    },
    source: {
      findUnique: jest.fn<() => Promise<{ id: number } | null>>(),
    },
    landmark: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    historicalEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    culturalTrait: {
      findMany: jest.fn(),
      create: jest.fn(),
    },

    economicActivity: {
      findMany: jest.fn(),
      create: jest.fn(),
    },

    facility: {
      findMany: jest.fn(),
      create: jest.fn(),
    },

    $transaction:
      jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );

    auditMock = {
      log: jest
        .fn<() => Promise<{ id: string }>>()
        .mockResolvedValue({ id: '1' }),
    };

    service = new HeritageService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('should throw NotFoundException when village does not exist', async () => {
    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(service.getLandmarksByVillage(99999)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.landmark.findMany).not.toHaveBeenCalled();
  });

  it('should return non-rejected landmarks for an existing village', async () => {
    prismaMock.village.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    prismaMock.landmark.findMany.mockResolvedValueOnce([
      {
        id: 10,
        villageId: 1,
        nameAr: 'نبع القرية',
        status: 'VERIFIED',
      },
    ] as never);

    const result = await service.getLandmarksByVillage(1);

    expect(prismaMock.landmark.findMany).toHaveBeenCalledWith({
      where: {
        villageId: 1,
        status: {
          not: VerificationStatus.REJECTED,
        },
      },
      include: {
        source: {
          select: {
            title: true,
            type: true,
          },
        },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].nameAr).toBe('نبع القرية');
  });

  it('should create a landmark with PENDING status', async () => {
    const dto = {
      nameAr: 'نبع القرية',
      type: LandmarkType.SPRING,
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue({ id: 1 });

    const createdLandmark = {
      id: 10,
      villageId: 1,
      ...dto,
      submittedById: 3,
      status: VerificationStatus.PENDING,
    };

    prismaMock.landmark.create.mockReturnValue(createdLandmark as never);

    const result = await service.createLandmark(1, dto, 3);

    expect(prismaMock.landmark.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        villageId: 1,
        nameAr: 'نبع القرية',
        type: LandmarkType.SPRING,
        sourceId: 1,
        submittedById: 3,
        status: VerificationStatus.PENDING,
      }),
    });

    expect(result).toEqual(createdLandmark);

    expect(prismaMock.village.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        entityType: 'landmark',
        entityId: 10,
      }),
      prismaMock,
    );
  });

  it('should reject landmark creation when source does not exist', async () => {
    const dto = {
      nameAr: 'نبع القرية',
      type: LandmarkType.SPRING,
      sourceId: 99999,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue(null);

    await expect(service.createLandmark(1, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.source.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.landmark.create).not.toHaveBeenCalled();
  });

  it('should reject landmark creation when village does not exist', async () => {
    const dto = {
      nameAr: 'نبع القرية',
      type: LandmarkType.SPRING,
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue(null);

    await expect(service.createLandmark(99999, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.source.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.landmark.create).not.toHaveBeenCalled();
  });

  it('should retrieve non-rejected historical events for a village', async () => {
    prismaMock.village.findUnique.mockResolvedValue({ id: 1 });

    const events = [
      {
        id: 10,
        title: 'Historical Event',
        yearFrom: 1948,
        status: VerificationStatus.VERIFIED,
      },
    ];

    prismaMock.historicalEvent.findMany.mockReturnValue(events as never);

    const result = await service.getHistoricalEventsByVillage(1);

    expect(prismaMock.historicalEvent.findMany).toHaveBeenCalledWith({
      where: {
        status: {
          not: VerificationStatus.REJECTED,
        },
        villages: {
          some: {
            villageId: 1,
          },
        },
      },
      include: {
        source: {
          select: {
            title: true,
            type: true,
          },
        },
      },
      orderBy: {
        yearFrom: 'asc',
      },
    });

    expect(result).toEqual(events);
  });

  it('should reject historical events request when village does not exist', async () => {
    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(service.getHistoricalEventsByVillage(99999)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.historicalEvent.findMany).not.toHaveBeenCalled();
  });

  it('should create a historical event with PENDING status and village links', async () => {
    const dto = {
      title: 'Historical Event',
      description: 'An important event in village history',
      category: EventCategory.CULTURAL,
      datePrecision: DatePrecision.YEAR,
      yearFrom: 1948,
      yearTo: 1950,
      sourceId: 1,
      villageIds: [1, 2],
    };

    prismaMock.source.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.village.findMany.mockReturnValue([
      { id: 1 },
      { id: 2 },
    ] as never);

    const createdEvent = {
      id: 10,
      title: dto.title,
      status: VerificationStatus.PENDING,
      submittedById: 3,
      villages: [
        { eventId: 10, villageId: 1 },
        { eventId: 10, villageId: 2 },
      ],
    };

    prismaMock.historicalEvent.create.mockReturnValue(createdEvent as never);

    const result = await service.createHistoricalEvent(dto, 3);

    expect(prismaMock.source.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });

    expect(prismaMock.village.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2] },
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.historicalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Historical Event',
        sourceId: 1,
        submittedById: 3,
        status: VerificationStatus.PENDING,
        villages: {
          create: [{ villageId: 1 }, { villageId: 2 }],
        },
      }),
      include: { villages: true },
    });

    expect(result).toEqual(createdEvent);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        action: AuditAction.CREATE,
        entityType: 'historical_event',
        entityId: 10,
      }),
      prismaMock,
    );
  });

  it('should reject historical event creation when a village does not exist', async () => {
    const dto = {
      title: 'Historical Event',
      description: 'An important event in village history',
      category: EventCategory.CULTURAL,
      datePrecision: DatePrecision.YEAR,
      yearFrom: 1948,
      yearTo: 1950,
      sourceId: 1,
      villageIds: [1, 99999],
    };

    prismaMock.source.findUnique.mockResolvedValue({ id: 1 });

    // Only village 1 exists
    prismaMock.village.findMany.mockReturnValue([{ id: 1 }] as never);

    await expect(service.createHistoricalEvent(dto, 3)).rejects.toThrow(
      BadRequestException,
    );

    expect(prismaMock.historicalEvent.create).not.toHaveBeenCalled();
  });

  it('should reject historical event creation when source does not exist', async () => {
    const dto = {
      title: 'Historical Event',
      description: 'An important event in village history',
      category: EventCategory.CULTURAL,
      datePrecision: DatePrecision.YEAR,
      yearFrom: 1948,
      yearTo: 1950,
      sourceId: 99999,
      villageIds: [1, 2],
    };

    prismaMock.source.findUnique.mockResolvedValue(null);

    await expect(service.createHistoricalEvent(dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.source.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.village.findMany).not.toHaveBeenCalled();
    expect(prismaMock.historicalEvent.create).not.toHaveBeenCalled();
  });

  it('should return non-rejected cultural traits for an existing village', async () => {
    prismaMock.village.findUnique.mockResolvedValue({ id: 1 });

    const traits = [
      {
        id: 10,
        villageId: 1,
        title: 'التطريز الفلسطيني',
        category: 'CRAFT',
        status: VerificationStatus.VERIFIED,
      },
    ];

    prismaMock.culturalTrait.findMany.mockReturnValue(traits as never);

    const result = await service.getCulturalTraitsByVillage(1);

    expect(prismaMock.village.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });

    expect(prismaMock.culturalTrait.findMany).toHaveBeenCalledWith({
      where: {
        villageId: 1,
        status: {
          not: VerificationStatus.REJECTED,
        },
      },
      include: {
        source: {
          select: {
            title: true,
            type: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    expect(result).toEqual(traits);
  });

  it('should reject cultural traits request when village does not exist', async () => {
    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(service.getCulturalTraitsByVillage(99999)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.village.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.culturalTrait.findMany).not.toHaveBeenCalled();
  });

  it('should create a cultural trait with PENDING status', async () => {
    const dto = {
      category: CulturalCategory.CRAFT,
      title: 'التطريز الفلسطيني',
      description: 'حرفة تراثية فلسطينية',
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue({ id: 1 });

    const createdTrait = {
      id: 10,
      villageId: 1,
      ...dto,
      submittedById: 3,
      status: VerificationStatus.PENDING,
    };

    prismaMock.culturalTrait.create.mockReturnValue(createdTrait as never);

    const result = await service.createCulturalTrait(1, dto, 3);

    expect(prismaMock.culturalTrait.create).toHaveBeenCalledWith({
      data: {
        villageId: 1,
        category: CulturalCategory.CRAFT,
        title: 'التطريز الفلسطيني',
        description: 'حرفة تراثية فلسطينية',
        sourceId: 1,
        submittedById: 3,
        status: VerificationStatus.PENDING,
      },
    });

    expect(result).toEqual(createdTrait);
    expect(prismaMock.village.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        action: AuditAction.CREATE,
        entityType: 'cultural_trait',
        entityId: 10,
      }),
      prismaMock,
    );
  });

  it('should reject cultural trait creation when source does not exist', async () => {
    const dto = {
      category: CulturalCategory.CRAFT,
      title: 'التطريز الفلسطيني',
      description: 'حرفة تراثية فلسطينية',
      sourceId: 99999,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue(null);

    await expect(service.createCulturalTrait(1, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.source.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.culturalTrait.create).not.toHaveBeenCalled();
  });

  it('should reject cultural trait creation when village does not exist', async () => {
    const dto = {
      category: CulturalCategory.CRAFT,
      title: 'التطريز الفلسطيني',
      description: 'حرفة تراثية فلسطينية',
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue(null);

    await expect(service.createCulturalTrait(99999, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.village.findFirst).toHaveBeenCalledWith({
      where: {
        id: 99999,
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.source.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.culturalTrait.create).not.toHaveBeenCalled();
  });

  it('should return non-rejected economic activities for a village', async () => {
    prismaMock.village.findUnique.mockResolvedValue({ id: 1 });

    const activities = [
      {
        id: 10,
        villageId: 1,
        name: 'زراعة الزيتون',
        status: VerificationStatus.VERIFIED,
      },
    ];

    prismaMock.economicActivity.findMany.mockReturnValue(activities as never);

    const result = await service.getEconomicActivitiesByVillage(1);

    expect(prismaMock.village.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });

    expect(prismaMock.economicActivity.findMany).toHaveBeenCalledWith({
      where: {
        villageId: 1,
        status: {
          not: VerificationStatus.REJECTED,
        },
      },
      include: {
        source: {
          select: {
            title: true,
            type: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    expect(result).toEqual(activities);
  });

  it('should create an economic activity with PENDING status', async () => {
    const dto = {
      type: EconomicType.AGRICULTURE,
      name: 'زراعة الزيتون',
      description: 'إنتاج الزيتون وزيت الزيتون',
      importance: Importance.MAIN,
      yearFrom: 1950,
      yearTo: 2020,
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue({ id: 1 });

    const createdActivity = {
      id: 10,
      villageId: 1,
      ...dto,
      submittedById: 3,
      status: VerificationStatus.PENDING,
    };

    prismaMock.economicActivity.create.mockReturnValue(
      createdActivity as never,
    );

    const result = await service.createEconomicActivity(1, dto, 3);

    expect(prismaMock.economicActivity.create).toHaveBeenCalledWith({
      data: {
        villageId: 1,
        type: EconomicType.AGRICULTURE,
        name: 'زراعة الزيتون',
        description: 'إنتاج الزيتون وزيت الزيتون',
        importance: Importance.MAIN,
        yearFrom: 1950,
        yearTo: 2020,
        sourceId: 1,
        submittedById: 3,
        status: VerificationStatus.PENDING,
      },
    });

    expect(result).toEqual(createdActivity);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        action: AuditAction.CREATE,
        entityType: 'economic_activity',
        entityId: 10,
      }),
      prismaMock,
    );
  });

  it('should reject economic activity creation when village does not exist', async () => {
    const dto = {
      type: EconomicType.AGRICULTURE,
      name: 'زراعة الزيتون',
      importance: Importance.MAIN,
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue(null);

    await expect(service.createEconomicActivity(99999, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.village.findFirst).toHaveBeenCalledWith({
      where: {
        id: 99999,
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.source.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.economicActivity.create).not.toHaveBeenCalled();
  });

  it('should reject economic activity creation when source does not exist', async () => {
    const dto = {
      type: EconomicType.AGRICULTURE,
      name: 'زراعة الزيتون',
      importance: Importance.MAIN,
      sourceId: 99999,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue(null);

    await expect(service.createEconomicActivity(1, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.source.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.economicActivity.create).not.toHaveBeenCalled();
  });

  it('should reject economic activities request when village does not exist', async () => {
    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(service.getEconomicActivitiesByVillage(99999)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.village.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.economicActivity.findMany).not.toHaveBeenCalled();
  });

  it('should create a facility with PENDING verification status', async () => {
    const dto = {
      type: FacilityType.SCHOOL,
      name: 'مدرسة القرية',
      status: FacilityStatus.ACTIVE,
      yearEstablished: 1990,
      latitude: 32.2211,
      longitude: 35.2544,
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue({ id: 1 });
    const createdFacility = {
      id: 10,
      villageId: 1,
      ...dto,
      submittedById: 3,
      verificationStatus: VerificationStatus.PENDING,
    };

    prismaMock.facility.create.mockReturnValue(createdFacility as never);

    const result = await service.createFacility(1, dto, 3);

    expect(prismaMock.facility.create).toHaveBeenCalledWith({
      data: {
        villageId: 1,
        type: FacilityType.SCHOOL,
        name: 'مدرسة القرية',
        status: FacilityStatus.ACTIVE,
        yearEstablished: 1990,
        latitude: 32.2211,
        longitude: 35.2544,
        sourceId: 1,
        submittedById: 3,
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    expect(result).toEqual(createdFacility);

    expect(prismaMock.village.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        action: AuditAction.CREATE,
        entityType: 'facility',
        entityId: 10,
      }),
      prismaMock,
    );
  });

  it('should reject facility creation when village does not exist', async () => {
    const dto = {
      type: FacilityType.SCHOOL,
      name: 'مدرسة القرية',
      status: FacilityStatus.ACTIVE,
      sourceId: 1,
    };

    prismaMock.village.findFirst.mockResolvedValue(null);

    await expect(service.createFacility(99999, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.village.findFirst).toHaveBeenCalledWith({
      where: {
        id: 99999,
        deletedAt: null,
      },
      select: { id: true },
    });

    expect(prismaMock.source.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.facility.create).not.toHaveBeenCalled();
  });

  it('should reject facility creation when source does not exist', async () => {
    const dto = {
      type: FacilityType.SCHOOL,
      name: 'مدرسة القرية',
      status: FacilityStatus.ACTIVE,
      sourceId: 99999,
    };

    prismaMock.village.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue(null);

    await expect(service.createFacility(1, dto, 3)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.source.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.facility.create).not.toHaveBeenCalled();
  });

  it('should return non-rejected facilities for an existing village', async () => {
    prismaMock.village.findUnique.mockResolvedValue({ id: 1 });

    const facilities = [
      {
        id: 10,
        villageId: 1,
        name: 'مدرسة القرية',
        type: FacilityType.SCHOOL,
        status: FacilityStatus.ACTIVE,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      {
        id: 11,
        villageId: 1,
        name: 'العيادة القديمة',
        type: FacilityType.CLINIC,
        status: FacilityStatus.CLOSED,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    ];

    prismaMock.facility.findMany.mockReturnValue(facilities as never);

    const result = await service.getFacilitiesByVillage(1);

    expect(prismaMock.facility.findMany).toHaveBeenCalledWith({
      where: {
        villageId: 1,
        verificationStatus: {
          not: VerificationStatus.REJECTED,
        },
      },
      include: {
        source: {
          select: {
            title: true,
            type: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    expect(result).toEqual(facilities);
  });

  it('should reject facilities request when village does not exist', async () => {
    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(service.getFacilitiesByVillage(99999)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.village.findUnique).toHaveBeenCalledWith({
      where: { id: 99999 },
      select: { id: true },
    });

    expect(prismaMock.facility.findMany).not.toHaveBeenCalled();
  });
});
