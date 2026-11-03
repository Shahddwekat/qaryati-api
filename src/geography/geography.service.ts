import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeographyService {
  constructor(private readonly prisma: PrismaService) {}

  /** All governorates with the number of (not hidden) villages in each. */
  async listGovernorates() {
    const rows = await this.prisma.governorate.findMany({
      orderBy: { nameEn: 'asc' },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        _count: { select: { villages: { where: { deletedAt: null } } } },
      },
    });

    return rows.map(({ _count, ...g }) => ({
      ...g,
      villagesCount: _count.villages,
    }));
  }

  /** Municipalities and village councils of one governorate. */
  async listMunicipalities(governorateId: number) {
    const governorate = await this.prisma.governorate.findUnique({
      where: { id: governorateId },
      select: { id: true },
    });
    if (!governorate) {
      throw new NotFoundException(`Governorate #${governorateId} not found`);
    }

    return this.prisma.municipality.findMany({
      where: { governorateId },
      orderBy: { nameEn: 'asc' },
      select: { id: true, nameAr: true, nameEn: true, type: true },
    });
  }
}
