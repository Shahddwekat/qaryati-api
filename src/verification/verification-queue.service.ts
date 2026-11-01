import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueQueryDto } from './dto/queue-query.dto';
import {
  ENTITY_SLUGS,
  Reviewer,
  SLUG_BY_ENTITY,
  VerifiableEntity,
} from './verification.types';

/**
 * One SELECT per fact table, all returning the same columns:
 * entity_type, id, village_id, label, submitted_by, created_at.
 * Every column is aliased in every SELECT, because a single SELECT is used on
 * its own when the queue is filtered by type.
 * These are constants (never built from user input). Raw SQL is used because
 * a UNION ALL across eight tables is not expressible with the ORM.
 */
export const QUEUE_SELECTS: Readonly<Record<VerifiableEntity, Prisma.Sql>> = {
  [VerifiableEntity.VILLAGE_NAME]: Prisma.sql`SELECT 'village_name' AS entity_type, id, village_id, name AS label, submitted_by, created_at FROM village_names WHERE status = 'PENDING'`,
  [VerifiableEntity.POPULATION_RECORD]: Prisma.sql`SELECT 'population_record' AS entity_type, id, village_id, CONCAT(year, ': ', population) AS label, submitted_by, created_at FROM population_records WHERE status = 'PENDING'`,
  [VerifiableEntity.HISTORICAL_EVENT]: Prisma.sql`SELECT 'historical_event' AS entity_type, id, NULL AS village_id, title AS label, submitted_by, created_at FROM historical_events WHERE status = 'PENDING'`,
  [VerifiableEntity.LANDMARK]: Prisma.sql`SELECT 'landmark' AS entity_type, id, village_id, name_ar AS label, submitted_by, created_at FROM landmarks WHERE status = 'PENDING'`,
  [VerifiableEntity.CULTURAL_TRAIT]: Prisma.sql`SELECT 'cultural_trait' AS entity_type, id, village_id, title AS label, submitted_by, created_at FROM cultural_traits WHERE status = 'PENDING'`,
  [VerifiableEntity.ECONOMIC_ACTIVITY]: Prisma.sql`SELECT 'economic_activity' AS entity_type, id, village_id, name AS label, submitted_by, created_at FROM economic_activities WHERE status = 'PENDING'`,
  [VerifiableEntity.FACILITY]: Prisma.sql`SELECT 'facility' AS entity_type, id, village_id, name AS label, submitted_by, created_at FROM facilities WHERE verification_status = 'PENDING'`,
  [VerifiableEntity.VILLAGE_RELATION]: Prisma.sql`SELECT 'village_relation' AS entity_type, id, village_id, CONCAT(type, ' -> village ', related_village_id) AS label, submitted_by, created_at FROM village_relations WHERE status = 'PENDING'`,
};

interface QueueRow {
  entity_type: VerifiableEntity;
  id: number | bigint;
  village_id: number | bigint | null;
  label: string;
  submitted_by: number | bigint;
  created_at: Date;
}

@Injectable()
export class VerificationQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Facts waiting for review, oldest first. Facts submitted by the reviewer
   * are left out because the four-eyes rule forbids reviewing them anyway.
   */
  async list(query: QueueQueryDto, reviewer: Reviewer) {
    const entities = query.entityType
      ? [ENTITY_SLUGS[query.entityType]]
      : Object.values(VerifiableEntity);
    const union = Prisma.join(
      entities.map((e) => QUEUE_SELECTS[e]),
      ' UNION ALL ',
    );
    const offset = (query.page - 1) * query.limit;

    const [rows, counts] = await Promise.all([
      this.prisma.$queryRaw<QueueRow[]>(
        Prisma.sql`SELECT q.entity_type, q.id, q.village_id, q.label, q.submitted_by, q.created_at
          FROM (${union}) q
          WHERE q.submitted_by <> ${reviewer.id}
          ORDER BY q.created_at ASC, q.entity_type ASC, q.id ASC
          LIMIT ${query.limit} OFFSET ${offset}`,
      ),
      this.prisma.$queryRaw<{ total: number | bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total
          FROM (${union}) q
          WHERE q.submitted_by <> ${reviewer.id}`,
      ),
    ]);

    // COUNT(*) comes back as BigInt, which JSON cannot serialize.
    const total = Number(counts[0]?.total ?? 0);

    return {
      data: rows.map((r) => ({
        entityType: r.entity_type,
        type: SLUG_BY_ENTITY[r.entity_type], // URL segment for /verification/:type/:id/verify
        id: Number(r.id),
        villageId: r.village_id === null ? null : Number(r.village_id),
        label: r.label,
        submittedBy: Number(r.submitted_by),
        createdAt: r.created_at,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
