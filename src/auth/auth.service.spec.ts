
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { jest } from '@jest/globals';
describe('AuthService - Register Audit', () => {
  const createdUser = {
    id: 1,
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'CONTRIBUTOR',
    createdAt: new Date('2026-01-01'),
  };

  let service: AuthService;

  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let tx: {
    user: {
      create: jest.Mock;
    };
  };

  let auditService: {
    log: jest.Mock;
  };

  beforeEach(() => {
    tx = {
      user: {
        create: jest.fn().mockResolvedValue(createdUser),
      },
    };

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      auditService as unknown as AuditService,
    );
  });

  it('creates an audit log when a user registers', async () => {
    const result = await service.register(
      ' TEST@example.com ',
      'StrongPassword123!',
      ' Test User ',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: 'test@example.com',
        passwordHash: expect.any(String),
        fullName: 'Test User',
        role: 'CONTRIBUTOR',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    expect(auditService.log).toHaveBeenCalledWith(
      {
        userId: 1,
        action: AuditAction.CREATE,
        entityType: 'User',
        entityId: 1,
        afterData: {
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'CONTRIBUTOR',
        },
      },
      tx,
    );

    expect(result).toEqual(createdUser);
  });

  it('does not create an audit log for an existing email', async () => {
    prisma.user.findUnique.mockResolvedValue(createdUser);

    await expect(
      service.register(
        'test@example.com',
        'StrongPassword123!',
        'Test User',
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('fails registration if audit logging fails', async () => {
    auditService.log.mockRejectedValue(
      new Error('Audit logging failed'),
    );

    await expect(
      service.register(
        'test@example.com',
        'StrongPassword123!',
        'Test User',
      ),
    ).rejects.toThrow('Audit logging failed');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
