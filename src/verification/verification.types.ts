import { UserRole } from '../generated/prisma/client';

/**
 * Every kind of fact that goes through PENDING -> VERIFIED / REJECTED.
 * The value is also the `entityType` written to audit_logs (snake_case, like the
 * rest of the project, so the audit log is easy to search).
 */
export enum VerifiableEntity {
  VILLAGE_NAME = 'village_name',
  POPULATION_RECORD = 'population_record',
  HISTORICAL_EVENT = 'historical_event',
  LANDMARK = 'landmark',
  CULTURAL_TRAIT = 'cultural_trait',
  ECONOMIC_ACTIVITY = 'economic_activity',
  FACILITY = 'facility',
  VILLAGE_RELATION = 'village_relation',
}

export interface VerifiableEntityConfig {
  /** Property name of the Prisma delegate, e.g. `populationRecord`. */
  readonly delegate: string;
  /**
   * Column that holds the verification status. `Facility` is the exception:
   * its `status` column is the operational status, so it uses `verificationStatus`.
   */
  readonly statusField: 'status' | 'verificationStatus';
  /**
   * Columns that define a group in which only ONE row may be `isPreferred`.
   * Absent = this kind of fact has no "preferred" concept.
   */
  readonly preferredGroup?: readonly string[];
}

export const VERIFIABLE_ENTITIES: Readonly<
  Record<VerifiableEntity, VerifiableEntityConfig>
> = {
  [VerifiableEntity.VILLAGE_NAME]: {
    delegate: 'villageName',
    statusField: 'status',
    preferredGroup: ['villageId', 'language', 'type'],
  },
  [VerifiableEntity.POPULATION_RECORD]: {
    delegate: 'populationRecord',
    statusField: 'status',
    preferredGroup: ['villageId', 'year'],
  },
  [VerifiableEntity.HISTORICAL_EVENT]: {
    delegate: 'historicalEvent',
    statusField: 'status',
  },
  [VerifiableEntity.LANDMARK]: {
    delegate: 'landmark',
    statusField: 'status',
  },
  [VerifiableEntity.CULTURAL_TRAIT]: {
    delegate: 'culturalTrait',
    statusField: 'status',
  },
  [VerifiableEntity.ECONOMIC_ACTIVITY]: {
    delegate: 'economicActivity',
    statusField: 'status',
  },
  [VerifiableEntity.FACILITY]: {
    delegate: 'facility',
    statusField: 'verificationStatus',
  },
  [VerifiableEntity.VILLAGE_RELATION]: {
    delegate: 'villageRelation',
    statusField: 'status',
  },
};

/** The authenticated user, as produced by JwtAuthGuard / @CurrentUser(). */
export interface Reviewer {
  id: number;
  role: string;
}

export const REVIEWER_ROLES: readonly string[] = [
  UserRole.VERIFIER,
  UserRole.ADMIN,
];

/** URL segment -> fact type, e.g. PATCH /verification/population-records/12/verify */
export const ENTITY_SLUGS: Readonly<Record<string, VerifiableEntity>> = {
  'village-names': VerifiableEntity.VILLAGE_NAME,
  'population-records': VerifiableEntity.POPULATION_RECORD,
  'historical-events': VerifiableEntity.HISTORICAL_EVENT,
  landmarks: VerifiableEntity.LANDMARK,
  'cultural-traits': VerifiableEntity.CULTURAL_TRAIT,
  'economic-activities': VerifiableEntity.ECONOMIC_ACTIVITY,
  facilities: VerifiableEntity.FACILITY,
  'village-relations': VerifiableEntity.VILLAGE_RELATION,
};

export const ENTITY_SLUG_LIST: readonly string[] = Object.keys(ENTITY_SLUGS);

export const SLUG_BY_ENTITY: Readonly<Record<VerifiableEntity, string>> =
  Object.fromEntries(
    Object.entries(ENTITY_SLUGS).map(([slug, entity]) => [entity, slug]),
  ) as Record<VerifiableEntity, string>;
