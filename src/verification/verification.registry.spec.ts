import { Prisma } from '../generated/prisma/client';
import { VERIFIABLE_ENTITIES, VerifiableEntity } from './verification.types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * VerificationService reaches Prisma by name (`tx[delegate]`) and by column
 * name, which TypeScript cannot check. These tests compare the registry with
 * the generated Prisma client, so a renamed model or column fails here.
 */
describe('verifiable entity registry matches the Prisma schema', () => {
  const scalarFields = (model: string): string[] => {
    const fieldEnum = (Prisma as unknown as Record<string, object>)[
      `${model}ScalarFieldEnum`
    ];
    return fieldEnum ? Object.keys(fieldEnum) : [];
  };

  it.each(Object.entries(VERIFIABLE_ENTITIES))(
    '%s: model and review columns exist',
    (_entity, cfg) => {
      const model = capitalize(cfg.delegate);
      expect(Object.values(Prisma.ModelName)).toContain(model);

      const fields = scalarFields(model);
      expect(fields).toEqual(
        expect.arrayContaining([
          cfg.statusField,
          'submittedById',
          'verifiedById',
          'verifiedAt',
          'rejectionReason',
        ]),
      );
      // A table that has a `verificationStatus` column keeps its operational
      // `status` separate (Facility), so verification must use that column.
      if (fields.includes('verificationStatus')) {
        expect(cfg.statusField).toBe('verificationStatus');
      }
      if (cfg.preferredGroup) {
        expect(fields).toEqual(
          expect.arrayContaining([...cfg.preferredGroup, 'isPreferred']),
        );
      }
    },
  );

  it('covers every verifiable entity', () => {
    expect(Object.keys(VERIFIABLE_ENTITIES).sort()).toEqual(
      Object.values(VerifiableEntity).sort(),
    );
  });

  it('uses snake_case entity names for the audit log', () => {
    for (const entity of Object.values(VerifiableEntity)) {
      expect(entity).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
