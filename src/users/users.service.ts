
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  UserRole,
  AuditAction,
} from '../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async updateRole(
    userId: number,
    role: UserRole,
    currentUserId: number,
  ) {
    if (userId === currentUserId && role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'You cannot remove your own admin role',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      await this.auditService.log(
        {
          userId: currentUserId,
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: userId,
          beforeData: { role: user.role },
          afterData: { role: updated.role },
        },
        tx,
      );

      return updated;
    });
  }

  async disableUser(userId: number, currentUserId: number) {
    if (userId === currentUserId) {
      throw new BadRequestException(
        'You cannot disable your own account',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.isActive) {
        throw new BadRequestException('User is already disabled');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

      await this.auditService.log(
        {
          userId: currentUserId,
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: userId,
          beforeData: { isActive: user.isActive },
          afterData: { isActive: updated.isActive },
        },
        tx,
      );

      return updated;
    });
  }
}
