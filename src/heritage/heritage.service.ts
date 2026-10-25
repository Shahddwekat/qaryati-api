import { VerificationStatus } from '../generated/prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HeritageService {
  constructor(private readonly prisma: PrismaService) {}

  async getLandmarksByVillage(villageId: number) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
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
}