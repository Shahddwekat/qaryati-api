import 'reflect-metadata';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueueQueryDto } from './dto/queue-query.dto';
import { RejectFactDto } from './dto/reject-fact.dto';
import { ParseVerifiableEntityPipe } from './parse-verifiable-entity.pipe';
import { VerificationController } from './verification.controller';
import {
  QUEUE_SELECTS,
  VerificationQueueService,
} from './verification-queue.service';
import { VerifiableEntity } from './verification.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

const errorsOf = async <T extends object>(cls: new () => T, plain: object) =>
  (
    await validate(plainToInstance(cls, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('ParseVerifiableEntityPipe', () => {
  const pipe = new ParseVerifiableEntityPipe();

  it('maps every URL segment to its entity', () => {
    expect(pipe.transform('population-records')).toBe(
      VerifiableEntity.POPULATION_RECORD,
    );
    expect(pipe.transform('facilities')).toBe(VerifiableEntity.FACILITY);
    expect(pipe.transform('village-names')).toBe(VerifiableEntity.VILLAGE_NAME);
  });

  it.each(['users', 'constructor', '__proto__', ''])(
    'answers 404 for %p',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(NotFoundException);
    },
  );
});

describe('verification DTOs', () => {
  it('RejectFactDto requires a reason of at most 500 characters', async () => {
    expect(await errorsOf(RejectFactDto, { reason: 'Wrong year' })).toEqual([]);
    expect(await errorsOf(RejectFactDto, {})).toContain('reason');
    expect(await errorsOf(RejectFactDto, { reason: '' })).toContain('reason');
    expect(
      await errorsOf(RejectFactDto, { reason: 'x'.repeat(501) }),
    ).toContain('reason');
  });

  it('QueueQueryDto applies defaults and validates the filter', async () => {
    expect(plainToInstance(QueueQueryDto, {})).toMatchObject({
      page: 1,
      limit: 20,
    });
    expect(
      await errorsOf(QueueQueryDto, { entityType: 'landmarks', limit: '50' }),
    ).toEqual([]);
    expect(await errorsOf(QueueQueryDto, { entityType: 'users' })).toContain(
      'entityType',
    );
    expect(await errorsOf(QueueQueryDto, { limit: '101' })).toContain('limit');
  });
});

describe('VerificationController', () => {
  const user = { id: 2, email: 'v@x.org', role: 'VERIFIER' };

  function build() {
    const verification = {
      verify: mockFn().mockResolvedValue({ ok: 'verify' }),
      reject: mockFn().mockResolvedValue({ ok: 'reject' }),
      prefer: mockFn().mockResolvedValue({ ok: 'prefer' }),
    };
    const queue = { list: mockFn().mockResolvedValue({ data: [] }) };
    const controller = new VerificationController(
      verification as never,
      queue as never,
    );
    return { controller, verification, queue };
  }

  it('passes entity, id, user and ip to verify', async () => {
    const { controller, verification } = build();
    await controller.verify(VerifiableEntity.LANDMARK, 7, user, '1.1.1.1');
    expect(verification.verify).toHaveBeenCalledWith(
      VerifiableEntity.LANDMARK,
      7,
      user,
      '1.1.1.1',
    );
  });

  it('passes the reason to reject', async () => {
    const { controller, verification } = build();
    await controller.reject(
      VerifiableEntity.FACILITY,
      3,
      { reason: 'Duplicate' },
      user,
      '1.1.1.1',
    );
    expect(verification.reject).toHaveBeenCalledWith(
      VerifiableEntity.FACILITY,
      3,
      user,
      'Duplicate',
      '1.1.1.1',
    );
  });

  it('passes the reviewer to the queue', async () => {
    const { controller, queue } = build();
    const query = plainToInstance(QueueQueryDto, {});
    await controller.getQueue(query, user);
    expect(queue.list).toHaveBeenCalledWith(query, user);
  });
});

describe('VerificationQueueService', () => {
  const reviewer = { id: 2, role: 'VERIFIER' };

  function build(rows: unknown[] = [], total: unknown = 0) {
    const queryRaw = mockFn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ total }]);
    const service = new VerificationQueueService({
      $queryRaw: queryRaw,
    } as never);
    return { service, queryRaw };
  }

  it('has one SELECT per entity, labelled with that entity name', () => {
    for (const entity of Object.values(VerifiableEntity)) {
      expect(QUEUE_SELECTS[entity].sql).toContain(`'${entity}'`);
    }
  });

  it('unions all eight tables by default and excludes the reviewer own submissions', async () => {
    const { service, queryRaw } = build();
    await service.list(Object.assign(new QueueQueryDto(), { page: 3, limit: 10 }), reviewer);

    const rowsQuery = queryRaw.mock.calls[0][0];
    expect(rowsQuery.sql.match(/UNION ALL/g)).toHaveLength(7);
    expect(rowsQuery.sql).toContain('q.submitted_by <>');
    // values: reviewer id, limit, offset  (page 3 of 10 -> offset 20)
    expect(rowsQuery.values).toEqual([2, 10, 20]);
  });

  it('queries a single table when entityType is given', async () => {
    const { service, queryRaw } = build();
    await service.list(
      Object.assign(new QueueQueryDto(), { entityType: 'landmarks' }),
      reviewer,
    );
    const sql = queryRaw.mock.calls[0][0].sql;
    expect(sql).toContain('FROM landmarks');
    expect(sql).not.toContain('UNION ALL');
    expect(sql).not.toContain('population_records');
  });

  it('converts BigInt counts and ids so the response can be serialized', async () => {
    const { service } = build(
      [
        {
          entity_type: 'population_record',
          id: 5n,
          village_id: 2n,
          label: '2007: 600',
          submitted_by: 3n,
          created_at: new Date('2026-10-31T10:00:00Z'),
        },
        {
          entity_type: 'historical_event',
          id: 1,
          village_id: null,
          label: 'Event X',
          submitted_by: 3,
          created_at: new Date('2026-10-31T11:00:00Z'),
        },
      ],
      45n,
    );
    const result = await service.list(new QueueQueryDto(), reviewer);

    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 });
    expect(result.data[0]).toMatchObject({
      type: 'population-records',
      id: 5,
      villageId: 2,
      submittedBy: 3,
    });
    expect(result.data[1].villageId).toBeNull();
  });
});
