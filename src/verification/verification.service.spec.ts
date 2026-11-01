import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerifiableEntity, Reviewer } from './verification.types';

const VERIFIER: Reviewer = { id: 2, role: 'VERIFIER' };
const ADMIN: Reviewer = { id: 1, role: 'ADMIN' };
const CONTRIBUTOR: Reviewer = { id: 3, role: 'CONTRIBUTOR' };

const pendingPopulation = (over: Record<string, unknown> = {}) => ({
  id: 10,
  villageId: 5,
  year: 1997,
  population: 1200,
  status: 'PENDING',
  isPreferred: null,
  submittedById: 3,
  verifiedById: null,
  verifiedAt: null,
  rejectionReason: null,
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

function makeDelegate() {
  return {
    findUnique: mockFn(),
    findFirst: mockFn(),
    updateMany: mockFn().mockResolvedValue({ count: 1 }),
  };
}

function setup() {
  const delegate = makeDelegate();
  const tx = { populationRecord: delegate, facility: makeDelegate() };
  const prisma = {
    $transaction: mockFn().mockImplementation((cb: AnyFn) => cb(tx)),
  };
  const audit = { log: mockFn().mockResolvedValue({}) };
  const service = new VerificationService(prisma as never, audit as never);
  return { service, delegate, tx, prisma, audit };
}

describe('VerificationService', () => {
  describe('permissions', () => {
    it.each(['verify', 'prefer'] as const)(
      '%s rejects a CONTRIBUTOR before touching the database',
      async (method) => {
        const { service, prisma } = setup();
        await expect(
          service[method](VerifiableEntity.POPULATION_RECORD, 10, CONTRIBUTOR),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('reject rejects a CONTRIBUTOR', async () => {
      const { service } = setup();
      await expect(
        service.reject(VerifiableEntity.POPULATION_RECORD, 10, CONTRIBUTOR, 'x'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('verify', () => {
    it('marks a PENDING fact VERIFIED and audits it in the same transaction', async () => {
      const { service, delegate, tx, audit } = setup();
      delegate.findUnique
        .mockResolvedValueOnce(pendingPopulation())
        .mockResolvedValueOnce(
          pendingPopulation({
            status: 'VERIFIED',
            verifiedById: 2,
            verifiedAt: new Date('2026-10-26T10:00:00Z'),
          }),
        );

      const result = await service.verify(
        VerifiableEntity.POPULATION_RECORD,
        10,
        VERIFIER,
        '1.2.3.4',
      );

      expect(result.status).toBe('VERIFIED');
      expect(delegate.updateMany).toHaveBeenCalledWith({
        where: { id: 10, status: 'PENDING' },
        data: expect.objectContaining({
          status: 'VERIFIED',
          verifiedById: 2,
          rejectionReason: null,
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          action: 'VERIFY',
          entityType: 'population_record',
          entityId: 10,
          ipAddress: '1.2.3.4',
          beforeData: expect.objectContaining({ status: 'PENDING' }),
          afterData: expect.objectContaining({
            status: 'VERIFIED',
            verifiedAt: '2026-10-26T10:00:00.000Z',
          }),
        }),
        tx, // same transaction client
      );
    });

    it('lets an ADMIN verify too', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(pendingPopulation());
      await expect(
        service.verify(VerifiableEntity.POPULATION_RECORD, 10, ADMIN),
      ).resolves.toBeDefined();
    });

    it('forbids reviewing your own submission (four-eyes rule)', async () => {
      const { service, delegate, audit } = setup();
      delegate.findUnique.mockResolvedValue(
        pendingPopulation({ submittedById: VERIFIER.id }),
      );
      await expect(
        service.verify(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(delegate.updateMany).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it.each(['VERIFIED', 'REJECTED'])(
      'conflicts when the fact is already %s',
      async (status) => {
        const { service, delegate } = setup();
        delegate.findUnique.mockResolvedValue(pendingPopulation({ status }));
        await expect(
          service.verify(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('throws NotFound for a missing fact', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(null);
      await expect(
        service.verify(VerifiableEntity.POPULATION_RECORD, 99, VERIFIER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('conflicts (and writes no audit) when someone else changed the fact first', async () => {
      const { service, delegate, audit } = setup();
      delegate.findUnique.mockResolvedValue(pendingPopulation());
      delegate.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.verify(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('uses verificationStatus for facilities', async () => {
      const { service, tx } = setup();
      tx.facility.findUnique.mockResolvedValue({
        id: 7,
        verificationStatus: 'PENDING',
        status: 'ACTIVE', // operational status must stay untouched
        submittedById: 3,
      });
      await service.verify(VerifiableEntity.FACILITY, 7, VERIFIER);
      expect(tx.facility.updateMany).toHaveBeenCalledWith({
        where: { id: 7, verificationStatus: 'PENDING' },
        data: expect.objectContaining({ verificationStatus: 'VERIFIED' }),
      });
      const data = tx.facility.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('status');
    });
  });

  describe('reject', () => {
    it('requires a non-empty reason', async () => {
      const { service, prisma } = setup();
      await expect(
        service.reject(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER, '   '),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a reason longer than the column allows', async () => {
      const { service } = setup();
      await expect(
        service.reject(
          VerifiableEntity.POPULATION_RECORD,
          10,
          VERIFIER,
          'x'.repeat(501),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores the reason, clears isPreferred and audits REJECT', async () => {
      const { service, delegate, audit } = setup();
      delegate.findUnique.mockResolvedValue(
        pendingPopulation({ status: 'VERIFIED', isPreferred: true }),
      );

      await service.reject(
        VerifiableEntity.POPULATION_RECORD,
        10,
        VERIFIER,
        '  Source does not support this figure ',
      );

      expect(delegate.updateMany).toHaveBeenCalledWith({
        where: { id: 10, status: 'VERIFIED' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Source does not support this figure',
          isPreferred: null,
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REJECT' }),
        expect.anything(),
      );
    });

    it('does not touch isPreferred for facts without a preferred concept', async () => {
      const { service, tx } = setup();
      tx.facility.findUnique.mockResolvedValue({
        id: 7,
        verificationStatus: 'PENDING',
        submittedById: 3,
      });
      await service.reject(VerifiableEntity.FACILITY, 7, VERIFIER, 'duplicate');
      const data = tx.facility.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('isPreferred');
    });

    it('conflicts when already rejected', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(
        pendingPopulation({ status: 'REJECTED' }),
      );
      await expect(
        service.reject(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER, 'x'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('forbids rejecting your own submission', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(
        pendingPopulation({ submittedById: VERIFIER.id }),
      );
      await expect(
        service.reject(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER, 'x'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('prefer', () => {
    const verified = (over: Record<string, unknown> = {}) =>
      pendingPopulation({ status: 'VERIFIED', ...over });

    it('refuses entity types without a preferred concept', async () => {
      const { service } = setup();
      await expect(
        service.prefer(VerifiableEntity.LANDMARK, 1, VERIFIER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a fact that is not VERIFIED', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(pendingPopulation());
      await expect(
        service.prefer(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is idempotent when the fact is already preferred', async () => {
      const { service, delegate, audit } = setup();
      delegate.findUnique.mockResolvedValue(verified({ isPreferred: true }));
      await service.prefer(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER);
      expect(delegate.updateMany).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('clears the old preferred row BEFORE setting the new one', async () => {
      const { service, delegate, audit } = setup();
      delegate.findUnique.mockResolvedValue(verified());
      delegate.findFirst.mockResolvedValue(verified({ id: 4, isPreferred: true }));

      await service.prefer(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER);

      const calls = delegate.updateMany.mock.calls.map((c) => c[0]);
      expect(calls[0]).toEqual({
        where: { villageId: 5, year: 1997, isPreferred: true },
        data: { isPreferred: null },
      });
      expect(calls[1]).toEqual({
        where: { id: 10, status: 'VERIFIED' },
        data: { isPreferred: true },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SET_PREFERRED',
          beforeData: { isPreferred: false, previousPreferredId: 4 },
          afterData: { isPreferred: true },
        }),
        expect.anything(),
      );
    });

    it('skips the clearing step when the group has no preferred row yet', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(verified());
      delegate.findFirst.mockResolvedValue(null);
      await service.prefer(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER);
      expect(delegate.updateMany).toHaveBeenCalledTimes(1);
    });

    it('turns a unique-index race (P2002) into a 409', async () => {
      const { service, delegate } = setup();
      delegate.findUnique.mockResolvedValue(verified());
      delegate.findFirst.mockResolvedValue(null);
      delegate.updateMany.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.prefer(VerifiableEntity.POPULATION_RECORD, 10, VERIFIER),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
