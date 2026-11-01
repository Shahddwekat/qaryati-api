import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  VerificationStatus,
} from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  REVIEWER_ROLES,
  Reviewer,
  VERIFIABLE_ENTITIES,
  VerifiableEntity,
  VerifiableEntityConfig,
} from './verification.types';

type FactRow = Record<string, unknown>;

/** The few Prisma delegate methods this service needs, shared by every fact table. */
interface FactDelegate {
  findUnique(args: { where: { id: number } }): Promise<FactRow | null>;
  findFirst(args: { where: Record<string, unknown> }): Promise<FactRow | null>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

const MAX_REASON_LENGTH = 500; // rejection_reason is VARCHAR(500)

/**
 * The single place where verify / reject / set-preferred rules live (ADR-0005).
 * Feature modules (population, heritage, villages...) call this instead of
 * re-implementing the rules, so the behaviour is identical for every fact.
 *
 * Rules:
 *  - only VERIFIER or ADMIN may review (checked here, not only in controllers);
 *  - nobody reviews a fact they submitted themselves (four-eyes rule);
 *  - PENDING -> VERIFIED | REJECTED; a VERIFIED fact can later be REJECTED;
 *    a REJECTED fact is final (the contributor submits a corrected new row);
 *  - only a VERIFIED fact can be preferred, one per group;
 *  - every change and its audit row are written in ONE transaction.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async verify(
    entity: VerifiableEntity,
    id: number,
    reviewer: Reviewer,
    ipAddress?: string,
  ): Promise<FactRow> {
    this.assertReviewer(reviewer);
    const cfg = this.configFor(entity);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const delegate = this.delegateOf(tx, cfg);
      const row = await this.loadOrThrow(delegate, entity, id);
      this.assertNotOwnSubmission(row, reviewer);

      const current = row[cfg.statusField] as VerificationStatus;
      if (current !== VerificationStatus.PENDING) {
        throw new ConflictException(
          `Only PENDING facts can be verified (current status: ${current})`,
        );
      }

      await this.updateGuarded(delegate, cfg, id, current, {
        [cfg.statusField]: VerificationStatus.VERIFIED,
        verifiedById: reviewer.id,
        verifiedAt: new Date(),
        rejectionReason: null,
      });

      const after = await this.loadOrThrow(delegate, entity, id);
      await this.audit.log(
        {
          userId: reviewer.id,
          action: AuditAction.VERIFY,
          entityType: entity,
          entityId: id,
          beforeData: this.snapshot(row, cfg),
          afterData: this.snapshot(after, cfg),
          ipAddress,
        },
        tx,
      );
      return after;
    });
  }

  async reject(
    entity: VerifiableEntity,
    id: number,
    reviewer: Reviewer,
    reason: string,
    ipAddress?: string,
  ): Promise<FactRow> {
    this.assertReviewer(reviewer);
    const cfg = this.configFor(entity);

    const cleanReason = (reason ?? '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A rejection reason is required');
    }
    if (cleanReason.length > MAX_REASON_LENGTH) {
      throw new BadRequestException(
        `Rejection reason must be at most ${MAX_REASON_LENGTH} characters`,
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const delegate = this.delegateOf(tx, cfg);
      const row = await this.loadOrThrow(delegate, entity, id);
      this.assertNotOwnSubmission(row, reviewer);

      const current = row[cfg.statusField] as VerificationStatus;
      if (current === VerificationStatus.REJECTED) {
        throw new ConflictException('This fact is already rejected');
      }

      const data: Record<string, unknown> = {
        [cfg.statusField]: VerificationStatus.REJECTED,
        verifiedById: reviewer.id,
        verifiedAt: new Date(),
        rejectionReason: cleanReason,
      };
      // A rejected fact must not keep the "preferred" flag, otherwise the group
      // would point at a value that is no longer public.
      if (cfg.preferredGroup) {
        data.isPreferred = null;
      }

      await this.updateGuarded(delegate, cfg, id, current, data);

      const after = await this.loadOrThrow(delegate, entity, id);
      await this.audit.log(
        {
          userId: reviewer.id,
          action: AuditAction.REJECT,
          entityType: entity,
          entityId: id,
          beforeData: this.snapshot(row, cfg),
          afterData: this.snapshot(after, cfg),
          ipAddress,
        },
        tx,
      );
      return after;
    });
  }

  /**
   * Makes `id` the preferred value of its group (e.g. one population figure per
   * village and year). The previous preferred row is cleared first, in the same
   * transaction, because the database allows only one `isPreferred = 1` per group.
   */
  async prefer(
    entity: VerifiableEntity,
    id: number,
    reviewer: Reviewer,
    ipAddress?: string,
  ): Promise<FactRow> {
    this.assertReviewer(reviewer);
    const cfg = this.configFor(entity);
    const group = cfg.preferredGroup;
    if (!group) {
      throw new BadRequestException(
        `${entity} does not support a preferred value`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const delegate = this.delegateOf(tx, cfg);
        const row = await this.loadOrThrow(delegate, entity, id);

        if (row[cfg.statusField] !== VerificationStatus.VERIFIED) {
          throw new ConflictException(
            'Only VERIFIED facts can be set as preferred',
          );
        }
        if (row.isPreferred === true) {
          return row; // already preferred: nothing to change, nothing to audit
        }

        const groupWhere = Object.fromEntries(group.map((f) => [f, row[f]]));
        const previous = await delegate.findFirst({
          where: { ...groupWhere, isPreferred: true },
        });

        if (previous) {
          await delegate.updateMany({
            where: { ...groupWhere, isPreferred: true },
            data: { isPreferred: null },
          });
        }

        const { count } = await delegate.updateMany({
          where: {
            id,
            [cfg.statusField]: VerificationStatus.VERIFIED,
          },
          data: { isPreferred: true },
        });
        if (count !== 1) {
          throw new ConflictException(
            'The fact was changed by someone else, please reload and retry',
          );
        }

        const after = await this.loadOrThrow(delegate, entity, id);
        await this.audit.log(
          {
            userId: reviewer.id,
            action: AuditAction.SET_PREFERRED,
            entityType: entity,
            entityId: id,
            beforeData: {
              isPreferred: false,
              previousPreferredId: previous ? (previous.id as number) : null,
            },
            afterData: { isPreferred: true },
            ipAddress,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      // Two verifiers racing for the same group: the unique index rejects the loser.
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(
          'Another preferred value was set at the same time, please retry',
        );
      }
      throw error;
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  private assertReviewer(reviewer: Reviewer): void {
    if (!reviewer || !REVIEWER_ROLES.includes(reviewer.role)) {
      throw new ForbiddenException(
        'Only a VERIFIER or ADMIN can review facts',
      );
    }
  }

  private assertNotOwnSubmission(row: FactRow, reviewer: Reviewer): void {
    if (row.submittedById === reviewer.id) {
      throw new ForbiddenException(
        'You cannot review a fact that you submitted yourself',
      );
    }
  }

  private configFor(entity: VerifiableEntity): VerifiableEntityConfig {
    const cfg = VERIFIABLE_ENTITIES[entity];
    if (!cfg) {
      throw new BadRequestException(`Unknown entity type: ${String(entity)}`);
    }
    return cfg;
  }

  private delegateOf(
    tx: Prisma.TransactionClient,
    cfg: VerifiableEntityConfig,
  ): FactDelegate {
    return (tx as unknown as Record<string, FactDelegate>)[cfg.delegate];
  }

  private async loadOrThrow(
    delegate: FactDelegate,
    entity: VerifiableEntity,
    id: number,
  ): Promise<FactRow> {
    const row = await delegate.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`${entity} #${id} not found`);
    }
    return row;
  }

  /**
   * Updates only if the status is still what we read (optimistic check), so two
   * reviewers acting on the same fact cannot both succeed silently.
   */
  private async updateGuarded(
    delegate: FactDelegate,
    cfg: VerifiableEntityConfig,
    id: number,
    expectedStatus: VerificationStatus,
    data: Record<string, unknown>,
  ): Promise<void> {
    const { count } = await delegate.updateMany({
      where: { id, [cfg.statusField]: expectedStatus },
      data,
    });
    if (count !== 1) {
      throw new ConflictException(
        'The fact was changed by someone else, please reload and retry',
      );
    }
  }

  /** The review-related fields only, as JSON-safe values, for before/after in the audit log. */
  private snapshot(
    row: FactRow,
    cfg: VerifiableEntityConfig,
  ): Prisma.InputJsonValue {
    const toJson = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
    const out: Record<string, Prisma.InputJsonValue | null> = {
      status: toJson(row[cfg.statusField]) as string,
      verifiedById: (row.verifiedById as number | null) ?? null,
      verifiedAt: (toJson(row.verifiedAt) as string | null) ?? null,
      rejectionReason: (row.rejectionReason as string | null) ?? null,
    };
    if (cfg.preferredGroup) {
      out.isPreferred = row.isPreferred === true;
    }
    return out as Prisma.InputJsonValue;
  }
}
