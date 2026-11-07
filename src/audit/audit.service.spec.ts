
import { jest } from '@jest/globals';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../generated/prisma/client';

type AsyncMock = jest.Mock<
  (...args: any[]) => Promise<any>
>;

const createMock = (): AsyncMock =>
  jest.fn<(...args: any[]) => Promise<any>>();

describe('AuditService', () => {
  let service: AuditService;

  let prisma: {
    auditLog: {
      create: AsyncMock;
      findMany: AsyncMock;
    };
  };

  const sampleInput = {
    userId: 2,
    action: AuditAction.UPDATE,
    entityType: 'User',
    entityId: 4,
    beforeData: { role: 'CONTRIBUTOR' },
    afterData: { role: 'VERIFIER' },
    ipAddress: '127.0.0.1',
  };

  const sampleLog = {
    id: BigInt(1),
    ...sampleInput,
    createdAt: new Date('2026-11-01T10:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: createMock(),
        findMany: createMock(),
      },
    };

    service = new AuditService(
      prisma as unknown as PrismaService,
    );
  });

  it('should create the service', () => {
    expect(service).toBeDefined();
  });

  it('should save an audit log with before and after data', async () => {
    prisma.auditLog.create.mockResolvedValue(sampleLog);

    const result = await service.log(sampleInput);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 2,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: 4,
        beforeData: {
          role: 'CONTRIBUTOR',
        },
        afterData: {
          role: 'VERIFIER',
        },
        ipAddress: '127.0.0.1',
      },
    });

    expect(result.beforeData).toEqual({
      role: 'CONTRIBUTOR',
    });

    expect(result.afterData).toEqual({
      role: 'VERIFIER',
    });
  });

  it('should convert BigInt audit IDs to strings', async () => {
    prisma.auditLog.create.mockResolvedValue(sampleLog);

    const result = await service.log(sampleInput);

    expect(result.id).toBe('1');
    expect(typeof result.id).toBe('string');
  });

  it('should use the provided transaction', async () => {
    const transactionCreate = createMock();
    transactionCreate.mockResolvedValue(sampleLog);

    const tx = {
      auditLog: {
        create: transactionCreate,
      },
    };

    const result = await service.log(
      sampleInput,
      tx as any,
    );

    expect(transactionCreate).toHaveBeenCalledTimes(1);

    expect(transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 2,
        entityType: 'User',
        entityId: 4,
      }),
    });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(result.id).toBe('1');
  });

  it('should support createLog as an alias for log', async () => {
    prisma.auditLog.create.mockResolvedValue(sampleLog);

    const result = await service.createLog(sampleInput);

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('1');
  });

  it('should list audit logs with pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValue([sampleLog]);

    const result = await service.findAll(0, 20);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        where: {},
        orderBy: {
          createdAt: 'desc',
        },
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter audit logs by entityType and entityId', async () => {
    prisma.auditLog.findMany.mockResolvedValue([sampleLog]);

    const result = await service.findAll(
      0,
      10,
      ' User ',
      4,
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
        where: {
          entityType: 'User',
          entityId: 4,
        },
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe(4);
  });

  it('should handle an empty audit log list', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual([]);
  });
});
