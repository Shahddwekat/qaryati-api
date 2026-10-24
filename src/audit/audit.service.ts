
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditAction,
  Prisma,
} from '../generated/prisma/client';

type CreateAuditLogInput = {
  userId: number | null;
  action: AuditAction;
  entityType: string;
  entityId: number;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  ipAddress?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(data: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        beforeData: data.beforeData,
        afterData: data.afterData,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findAll(skip = 0, take = 20) {
    return this.prisma.auditLog.findMany({
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        beforeData: true,
        afterData: true,
        ipAddress: true,
        createdAt: true,
      },
    });
  }
}
