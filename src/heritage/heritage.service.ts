
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus } from '../generated/prisma/client';
import { CreateLandmarkDto } from './dto/create-landmark.dto';

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
}
