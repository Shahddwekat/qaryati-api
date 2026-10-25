import { CreateCulturalTraitDto } from './dto/create-cultural-trait.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus } from '../generated/prisma/client';
import { CreateLandmarkDto } from './dto/create-landmark.dto';
import { CreateHistoricalEventDto } from './dto/create-historical-event.dto';

@Injectable()
export class HeritageService {
  constructor(private readonly prisma: PrismaService) {}

  // Get verified landmarks for a specific village
  async getLandmarksByVillage(villageId: number) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    return this.prisma.landmark.findMany({
      where: {
        villageId,
        status: VerificationStatus.VERIFIED,
      },
    });
  }

  // Check if the source exists
  private async ensureSourceExists(sourceId: number): Promise<void> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });

    if (!source) {
      throw new NotFoundException('Source not found');
    }
  }

  // Create a new landmark with PENDING verification status
  async createLandmark(
    villageId: number,
    dto: CreateLandmarkDto,
    userId: number,
  ) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    await this.ensureSourceExists(dto.sourceId);

    return this.prisma.landmark.create({
      data: {
        villageId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        type: dto.type,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        period: dto.period,
        currentCondition: dto.currentCondition,
        sourceId: dto.sourceId,
        submittedById: userId,
        status: VerificationStatus.PENDING,
      },
    });
  }

  // Get verified historical events for a specific village
  async getHistoricalEventsByVillage(villageId: number) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    return this.prisma.historicalEvent.findMany({
      where: {
        status: VerificationStatus.VERIFIED,
        villages: {
          some: {
            villageId,
          },
        },
      },
      orderBy: {
        yearFrom: 'asc',
      },
    });
  }

  // Create a historical event and link it to villages
  async createHistoricalEvent(
    dto: CreateHistoricalEventDto,
    userId: number,
  ) {
    // 1. Check that the source exists
    await this.ensureSourceExists(dto.sourceId);

    // 2. Check that all villages exist
    const villages = await this.prisma.village.findMany({
      where: {
        id: {
          in: dto.villageIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (villages.length !== dto.villageIds.length) {
      throw new BadRequestException(
        'One or more villages do not exist',
      );
    }

    // 3. Create the event and its village links atomically
    return this.prisma.historicalEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        datePrecision: dto.datePrecision,
        yearFrom: dto.yearFrom,
        yearTo: dto.yearTo,
        sourceId: dto.sourceId,
        submittedById: userId,
        status: VerificationStatus.PENDING,

        villages: {
          create: dto.villageIds.map((villageId) => ({
            villageId,
          })),
        },
      },
      include: {
        villages: true,
      },
    });
  }
  
  // Get verified cultural traits for a specific village
  async getCulturalTraitsByVillage(villageId: number) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    return this.prisma.culturalTrait.findMany({
      where: {
        villageId,
        status: VerificationStatus.VERIFIED,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  
  // Create a cultural trait with PENDING verification status
  async createCulturalTrait(
    villageId: number,
    dto: CreateCulturalTraitDto,
    userId: number,
  ) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    await this.ensureSourceExists(dto.sourceId);

    return this.prisma.culturalTrait.create({
      data: {
        villageId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        sourceId: dto.sourceId,
        submittedById: userId,
        status: VerificationStatus.PENDING,
      },
    });
  }


}
