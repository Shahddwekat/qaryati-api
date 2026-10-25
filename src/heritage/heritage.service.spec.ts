import { LandmarkType, VerificationStatus } from '../generated/prisma/client';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { HeritageService } from './heritage.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HeritageService', () => {
  let service: HeritageService;

  
 const prismaMock = {
  village: {
    findUnique: jest.fn<() => Promise<{ id: number } | null>>(),
  },
  source: {
    findUnique: jest.fn<() => Promise<{ id: number } | null>>(),
  },
  landmark: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
 };


  beforeEach(() => {
    jest.clearAllMocks();

    service = new HeritageService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('should throw NotFoundException when village does not exist', async () => {
    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(
      service.getLandmarksByVillage(99999),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.landmark.findMany).not.toHaveBeenCalled();
  });
  
  it('should return only verified landmarks for an existing village', async () => {
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
        status: 'VERIFIED',
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

    prismaMock.village.findUnique.mockResolvedValue({ id: 1 });
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
  });

  
  it('should reject landmark creation when source does not exist', async () => {
    const dto = {
      nameAr: 'نبع القرية',
      type: LandmarkType.SPRING,
      sourceId: 99999,
    };

    prismaMock.village.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.source.findUnique.mockResolvedValue(null);

    await expect(
      service.createLandmark(1, dto, 3),
    ).rejects.toThrow(NotFoundException);

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

    prismaMock.village.findUnique.mockResolvedValue(null);

    await expect(
      service.createLandmark(99999, dto, 3),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.source.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.landmark.create).not.toHaveBeenCalled();
  });

});
