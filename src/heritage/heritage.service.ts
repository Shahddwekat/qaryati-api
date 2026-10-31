import { CreateFacilityDto } from './dto/create-facility.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus } from '../generated/prisma/client';

import { CreateLandmarkDto } from './dto/create-landmark.dto';
import { CreateHistoricalEventDto } from './dto/create-historical-event.dto';
import { CreateCulturalTraitDto } from './dto/create-cultural-trait.dto';
import { CreateEconomicActivityDto } from './dto/create-economic-activity.dto';

@Injectable()
export class HeritageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}
  // ========================================
  // Landmarks
  // ========================================

  // Get verified landmarks for a village
  async getLandmarksByVillage(villageId: number) {
    await this.ensureVillageExists(villageId);

    return this.prisma.landmark.findMany({
      where: {
        villageId,
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
  }

  // Throw 404 if the village does not exist or is hidden (soft-deleted)
  private async ensureVillageExists(villageId: number): Promise<void> {
    const village = await this.prisma.village.findFirst({
      where: { id: villageId, deletedAt: null },
      select: { id: true },
    });

    if (!village) {
      throw new NotFoundException('Village not found');
    }
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
    await this.ensureVillageExists(villageId);

    await this.ensureSourceExists(dto.sourceId);

    return this.prisma.$transaction(async (tx) => {
      const landmark = await tx.landmark.create({
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

      await this.auditService.log(
        {
          userId,
          action: AuditAction.CREATE,
          entityType: 'landmark',
          entityId: landmark.id,
          afterData: {
            id: landmark.id,
            villageId: landmark.villageId,
            nameAr: landmark.nameAr,
            status: landmark.status,
          },
        },
        tx,
      );

      return landmark;
    });
  }
  // ========================================
  // Historical Events
  // ========================================

  // Get verified historical events for a village
  async getHistoricalEventsByVillage(villageId: number) {
    await this.ensureVillageExists(villageId);

    return this.prisma.historicalEvent.findMany({
      where: {
        status: {
          not: VerificationStatus.REJECTED,
        },
        villages: {
          some: {
            villageId,
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
  }

  // Create a historical event and link it to villages
  async createHistoricalEvent(dto: CreateHistoricalEventDto, userId: number) {
    await this.ensureSourceExists(dto.sourceId);

    // Check that all villages exist and are not soft-deleted
    const villages = await this.prisma.village.findMany({
      where: {
        id: {
          in: dto.villageIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (villages.length !== new Set(dto.villageIds).size) {
      throw new BadRequestException(
        'One or more villages do not exist or are deleted',
      );
    }

    // Create the event, village links, and audit log atomically
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.historicalEvent.create({
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

      await this.auditService.log(
        {
          userId,
          action: AuditAction.CREATE,
          entityType: 'historical_event',
          entityId: event.id,
          afterData: {
            id: event.id,
            title: event.title,
            status: event.status,
            villageIds: dto.villageIds,
          },
        },
        tx,
      );

      return event;
    });
  }
  // ========================================
  // Cultural Traits
  // ========================================

  // Get verified cultural traits for a village
  async getCulturalTraitsByVillage(villageId: number) {
    await this.ensureVillageExists(villageId);

    return this.prisma.culturalTrait.findMany({
      where: {
        villageId,
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
  }

  // Create a cultural trait with PENDING verification
  async createCulturalTrait(
    villageId: number,
    dto: CreateCulturalTraitDto,
    userId: number,
  ) {
    await this.ensureVillageExists(villageId);

    await this.ensureSourceExists(dto.sourceId);

    return this.prisma.$transaction(async (tx) => {
      const trait = await tx.culturalTrait.create({
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

      await this.auditService.log(
        {
          userId,
          action: AuditAction.CREATE,
          entityType: 'cultural_trait',
          entityId: trait.id,
          afterData: {
            id: trait.id,
            villageId: trait.villageId,
            title: trait.title,
            status: trait.status,
          },
        },
        tx,
      );

      return trait;
    });
  }

  // ========================================
  // Economic Activities
  // ========================================

  // Get verified economic activities for a village
  async getEconomicActivitiesByVillage(villageId: number) {
    await this.ensureVillageExists(villageId);

    return this.prisma.economicActivity.findMany({
      where: {
        villageId,
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
  }

  // Create an economic activity with PENDING verification
  async createEconomicActivity(
    villageId: number,
    dto: CreateEconomicActivityDto,
    userId: number,
  ) {
    await this.ensureVillageExists(villageId);

    await this.ensureSourceExists(dto.sourceId);

    // Create the activity and audit log in the same transaction
    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.economicActivity.create({
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

      await this.auditService.log(
        {
          userId,
          action: AuditAction.CREATE,
          entityType: 'economic_activity',
          entityId: activity.id,
          afterData: {
            id: activity.id,
            villageId: activity.villageId,
            name: activity.name,
            status: activity.status,
          },
        },
        tx,
      );

      return activity;
    });
  }

  // ========================================
  // Facilities
  // ========================================

  // Get verified facilities for a village
  async getFacilitiesByVillage(villageId: number) {
    await this.ensureVillageExists(villageId);

    return this.prisma.facility.findMany({
      where: {
        villageId,
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
  }

  // Create a facility with PENDING verification status
  async createFacility(
    villageId: number,
    dto: CreateFacilityDto,
    userId: number,
  ) {
    await this.ensureVillageExists(villageId);

    await this.ensureSourceExists(dto.sourceId);

    // Create the facility and audit log in the same transaction
    return this.prisma.$transaction(async (tx) => {
      const facility = await tx.facility.create({
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

      await this.auditService.log(
        {
          userId,
          action: AuditAction.CREATE,
          entityType: 'facility',
          entityId: facility.id,
          afterData: {
            id: facility.id,
            villageId: facility.villageId,
            name: facility.name,
            verificationStatus: facility.verificationStatus,
          },
        },
        tx,
      );

      return facility;
    });
  }
}
