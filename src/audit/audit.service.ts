
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditAction,
  Prisma,
} from '../generated/prisma/client';

export type AuditLogInput = {
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

  async log(
    data: AuditLogInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const auditLog = await client.auditLog.create({
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

    return {
      ...auditLog,
      id: auditLog.id.toString(),
    };
  }

  async createLog(data: AuditLogInput) {
    return this.log(data);
  }

  async findAll(
    skip = 0,
    take = 20,
    entityType?: string,
    entityId?: number,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(entityType !== undefined && {
        entityType: entityType.trim(),
      }),
      ...(entityId !== undefined && {
        entityId,
      }),
    };

    const logs = await this.prisma.auditLog.findMany({
      skip,
      take,
      where,
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

    return logs.map((log) => ({
      ...log,
      id: log.id.toString(),
    }));
  }
}
