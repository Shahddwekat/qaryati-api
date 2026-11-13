
import { jest } from '@jest/globals';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../generated/prisma/client';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

type AsyncMock = jest.Mock<
  (...args: any[]) => Promise<any>
>;

const createMock = (): AsyncMock =>
  jest.fn<(...args: any[]) => Promise<any>>();

describe('AuthService', () => {
  let service: AuthService;

  let prisma: {
    user: {
      findUnique: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
    };
    refreshToken: {
      create: AsyncMock;
      findFirst: AsyncMock;
      updateMany: AsyncMock;
    };
    $transaction: AsyncMock;
  };

  let jwtService: {
    signAsync: AsyncMock;
  };

  let auditService: {
    log: AsyncMock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: createMock(),
        create: createMock(),
        update: createMock(),
      },
      refreshToken: {
        create: createMock(),
        findFirst: createMock(),
        updateMany: createMock(),
      },
      $transaction: createMock(),
    };

    jwtService = {
      signAsync: createMock().mockResolvedValue(
        'test-access-token',
      ),
    };

    auditService = {
      log: createMock().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      auditService as unknown as AuditService,
    );
  });

  it('should create the service', () => {
    expect(service).toBeDefined();
  });

  it('should register a new contributor', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    // register() creates the user and its audit row in one transaction
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );

    prisma.user.create.mockImplementation(
      async ({ data }) => ({
        id: 1,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
      }),
    );

    const result = await service.register(
      ' TEST@example.com ',
      'Password123!',
      'Test User',
    );

    expect(result.email).toBe('test@example.com');
    expect(result.role).toBe('CONTRIBUTOR');

    const createData =
      prisma.user.create.mock.calls[0][0].data;

    expect(createData.passwordHash).not.toBe(
      'Password123!',
    );

    expect(
      await bcrypt.compare(
        'Password123!',
        createData.passwordHash,
      ),
    ).toBe(true);
  });

  it('should reject duplicate email registration', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
    });

    await expect(
      service.register(
        'test@example.com',
        'Password123!',
        'Test User',
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should login with valid credentials', async () => {
    const passwordHash = await bcrypt.hash(
      'Password123!',
      4,
    );

    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'CONTRIBUTOR',
      isActive: true,
      passwordHash,
    });

    prisma.refreshToken.create.mockResolvedValue({
      id: 1,
    });

    prisma.user.update.mockResolvedValue({
      id: 1,
    });

    const result = await service.login(
      'test@example.com',
      'Password123!',
    );

    expect(result.accessToken).toBe(
      'test-access-token',
    );

    expect(result.refreshToken).toBeDefined();
    expect(result.tokenType).toBe('Bearer');
    expect(result.user.role).toBe('CONTRIBUTOR');

    expect(
      prisma.refreshToken.create,
    ).toHaveBeenCalledTimes(1);
  });

  it('should reject an incorrect password', async () => {
    const passwordHash = await bcrypt.hash(
      'CorrectPassword123!',
      4,
    );

    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      isActive: true,
      passwordHash,
    });

    await expect(
      service.login(
        'test@example.com',
        'WrongPassword123!',
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(
      jwtService.signAsync,
    ).not.toHaveBeenCalled();
  });

  it('should reject login for a disabled user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      isActive: false,
    });

    await expect(
      service.login(
        'test@example.com',
        'Password123!',
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(
      prisma.refreshToken.create,
    ).not.toHaveBeenCalled();
  });

  it('should reject an invalid refresh token', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue(
      null,
    );

    await expect(
      service.refresh('invalid-refresh-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should revoke a refresh token on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.logout(
      'test-refresh-token',
    );

    expect(result.message).toBe(
      'Logged out successfully',
    );

    expect(
      prisma.refreshToken.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.any(String),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('should rotate a valid refresh token', async () => {
    const oldToken = 'old-refresh-token';

    const user = {
      id: 1,
      email: 'test@example.com',
      role: 'CONTRIBUTOR',
      isActive: true,
    };

    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 10,
      userId: 1,
      user,
    });

    prisma.refreshToken.updateMany.mockResolvedValue({
      count: 1,
    });

    prisma.refreshToken.create.mockResolvedValue({
      id: 11,
    });

    prisma.$transaction.mockImplementation(
      async (callback) => callback(prisma),
    );

    const result = await service.refresh(oldToken);

    expect(result.accessToken).toBe(
      'test-access-token',
    );

    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(oldToken);
    expect(result.tokenType).toBe('Bearer');

    const oldTokenHash = createHash('sha256')
      .update(oldToken)
      .digest('hex');

    expect(
      prisma.refreshToken.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        tokenHash: oldTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      include: {
        user: true,
      },
    });

    expect(
      prisma.refreshToken.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 10,
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    const newTokenHash = createHash('sha256')
      .update(result.refreshToken)
      .digest('hex');

    expect(
      prisma.refreshToken.create,
    ).toHaveBeenCalledWith({
      data: {
        userId: 1,
        tokenHash: newTokenHash,
        expiresAt: expect.any(Date),
      },
    });

    expect(
      prisma.$transaction,
    ).toHaveBeenCalledTimes(1);
  });

  it('should reject a refresh token already revoked', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 10,
      userId: 1,
      user: {
        id: 1,
        email: 'test@example.com',
        role: 'CONTRIBUTOR',
        isActive: true,
      },
    });

    prisma.refreshToken.updateMany.mockResolvedValue({
      count: 0,
    });

    prisma.$transaction.mockImplementation(
      async (callback) => callback(prisma),
    );

    await expect(
      service.refresh('already-used-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(
      prisma.refreshToken.create,
    ).not.toHaveBeenCalled();

    expect(
      jwtService.signAsync,
    ).not.toHaveBeenCalled();
  });
});

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
