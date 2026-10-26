import { CreateFacilityDto } from './dto/create-facility.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus } from '../generated/prisma/client';

import { CreateLandmarkDto } from './dto/create-landmark.dto';
import { CreateHistoricalEventDto } from './dto/create-historical-event.dto';
import { CreateCulturalTraitDto } from './dto/create-cultural-trait.dto';
import { CreateEconomicActivityDto } from './dto/create-economic-activity.dto';

@Injectable()
export class HeritageService {
  constructor(private readonly prisma: PrismaService) { }

  // ========================================
  // Landmarks
  // ========================================

  // Get verified landmarks for a village
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

  // Create a landmark with PENDING verification
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

  // ========================================
  // Historical Events
  // ========================================

  // Get verified historical events for a village
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

  // ========================================
  // Cultural Traits
  // ========================================

  // Get verified cultural traits for a village
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

  // Create a cultural trait with PENDING verification
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

  // ========================================
  // Economic Activities
  // ========================================

  // Get verified economic activities for a village
  async getEconomicActivitiesByVillage(villageId: number) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    return this.prisma.economicActivity.findMany({
      where: {
        villageId,
        status: VerificationStatus.VERIFIED,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  // Create an economic activity with PENDING verification
  async createEconomicActivity(
    villageId: number,
    dto: CreateEconomicActivityDto,
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

    return this.prisma.economicActivity.create({
      data: {
        villageId,
        type: dto.type,
        name: dto.name,
        description: dto.description,
        importance: dto.importance,
        yearFrom: dto.yearFrom,
        yearTo: dto.yearTo,
        sourceId: dto.sourceId,
        submittedById: userId,
        status: VerificationStatus.PENDING,
      },
    });
  }

  // ========================================
  // Facilities
  // ========================================

  // Get verified facilities for a village
  async getFacilitiesByVillage(villageId: number) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }

    return this.prisma.facility.findMany({
      where: {
        villageId,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }


  // Create a facility with PENDING verification status
  async createFacility(
    villageId: number,
    dto: CreateFacilityDto,
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

    return this.prisma.facility.create({
      data: {
        villageId,
        type: dto.type,
        name: dto.name,
        status: dto.status,
        yearEstablished: dto.yearEstablished,
        latitude: dto.latitude,
        longitude: dto.longitude,
        sourceId: dto.sourceId,
        submittedById: userId,
        verificationStatus: VerificationStatus.PENDING,
      },
    });
  }

}
