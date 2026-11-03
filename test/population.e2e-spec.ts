import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Population history, its review and the trends report, through real HTTP
 * calls against the real database (seeded with `npx prisma db seed`).
 *
 * The tests use village 6 (Battir, Bethlehem), which has no seeded population
 * figures, and remove everything they create (only the years listed below).
 * Seeded rows are never changed.
 */
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
const VILLAGE = 6;
const GOVERNORATE = 'Bethlehem';

// Years used by the tests (all far from the seeded 2017 figures).
const YEAR = 1650; // two sources disagree, one gets preferred
const WARN_YEAR = 1660; // implausible jump -> warning
const REJECT_YEAR = 1670; // rejected by a verifier
const OWN_YEAR = 1680; // verifier submits it, so someone else must verify

interface Session {
  token: string;
  id: number;
}

describe('Population (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let contributor: Session;
  let verifier: Session;
  let admin: Session;
  let sourceA: number;
  let sourceB: number;

  // ids created by the tests
  let r1: number; // YEAR, source A
  let r2: number; // YEAR, source B
  let rejected: number;

  const api = () => request(app.getHttpServer());
  const bearer = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

  async function login(email: string): Promise<Session> {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { token: res.body.accessToken, id: res.body.user.id };
  }

  const postPopulation = (s: Session | null, body: object) => {
    const req = api().post(`/api/v1/villages/${VILLAGE}/population`);
    return (s ? req.set(bearer(s)) : req).send(body);
  };

  async function cleanup() {
    // only the years used by these tests: never touch other data
    await prisma.populationRecord.deleteMany({
      where: {
        villageId: VILLAGE,
        year: { in: [YEAR, WARN_YEAR, REJECT_YEAR, OWN_YEAR] },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup(); // in case an earlier run was interrupted

    contributor = await login('contributor@qaryati.local');
    verifier = await login('verifier@qaryati.local');
    admin = await login('admin@qaryati.local');

    const sources = await api().get('/api/v1/sources').expect(200);
    sourceA = sources.body.data[0].id;
    sourceB = sources.body.data[1].id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('GET /villages/:id/population', () => {
    it('shows the seeded conflict: both sources visible, one of them preferred', async () => {
      const res = await api().get('/api/v1/villages/1/population').expect(200);
      const y2017 = res.body.find((y: { year: number }) => y.year === 2017);
      // (a person may have switched the preferred figure while testing by hand)
      expect(y2017.preferred).toMatchObject({
        isPreferred: true,
        status: 'VERIFIED',
      });
      expect(y2017.preferred.source).toHaveProperty('title');
      const shown = [y2017.preferred, ...y2017.alternatives].map(
        (r: { population: number }) => r.population,
      );
      expect(shown).toEqual(expect.arrayContaining([3200, 3350]));
    });

    it('answers 404 for a village that does not exist', async () => {
      await api().get('/api/v1/villages/999999/population').expect(404);
    });
  });

  describe('POST /villages/:id/population', () => {
    it('needs a token', async () => {
      await postPopulation(null, {
        year: YEAR,
        population: 1,
        sourceId: sourceA,
      }).expect(401);
    });

    it('rejects an impossible year with a list of messages', async () => {
      const res = await postPopulation(contributor, {
        year: 2999,
        population: 10,
        sourceId: sourceA,
      }).expect(400);
      expect(res.body.message[0]).toMatch(/year must be between 1500/);
    });

    it('rejects households greater than population', async () => {
      const res = await postPopulation(contributor, {
        year: YEAR,
        population: 10,
        households: 50,
        sourceId: sourceA,
      }).expect(400);
      expect(res.body.message).toContain(
        'households cannot be greater than population',
      );
    });

    it('does not let the caller set status, preferred flag or submitter', async () => {
      for (const extra of [
        { status: 'VERIFIED' },
        { isPreferred: true },
        { submittedById: 1 },
      ]) {
        await postPopulation(contributor, {
          year: YEAR,
          population: 10,
          sourceId: sourceA,
          ...extra,
        }).expect(400);
      }
    });

    it('answers 404 for an unknown source', async () => {
      await postPopulation(contributor, {
        year: YEAR,
        population: 10,
        sourceId: 999999,
      }).expect(404);
    });

    it('creates a PENDING record owned by the caller', async () => {
      const res = await postPopulation(contributor, {
        year: YEAR,
        population: 1200,
        households: 200,
        sourceId: sourceA,
      }).expect(201);
      r1 = res.body.record.id;
      expect(res.body.record).toMatchObject({
        status: 'PENDING',
        isPreferred: null,
        submittedById: contributor.id,
      });
      expect(res.body.warnings).toEqual([]);
    });

    it('answers 409 when the same source gives the same year twice', async () => {
      await postPopulation(contributor, {
        year: YEAR,
        population: 1250,
        sourceId: sourceA,
      }).expect(409);
    });

    it('keeps a figure from another source for the same year (conflict stays visible)', async () => {
      const res = await postPopulation(contributor, {
        year: YEAR,
        population: 1300,
        sourceId: sourceB,
      }).expect(201);
      r2 = res.body.record.id;
    });
  });

  describe('review queue', () => {
    it('is closed to contributors and anonymous users', async () => {
      await api()
        .get('/api/v1/verification/queue')
        .set(bearer(contributor))
        .expect(403);
      await api().get('/api/v1/verification/queue').expect(401);
    });

    it('lists pending facts for a verifier, with BigInt counts serialized', async () => {
      const res = await api()
        .get(
          '/api/v1/verification/queue?entityType=population-records&limit=100',
        )
        .set(bearer(verifier))
        .expect(200);
      const ids = res.body.data.map((i: { id: number }) => i.id);
      expect(ids).toEqual(expect.arrayContaining([r1, r2]));
      expect(
        res.body.data.every(
          (i: { entityType: string }) => i.entityType === 'population_record',
        ),
      ).toBe(true);
      expect(
        res.body.data.find((i: { id: number }) => i.id === r1),
      ).toMatchObject({
        type: 'population-records',
        villageId: VILLAGE,
        label: `${YEAR}: 1200`,
        submittedBy: contributor.id,
      });
      expect(typeof res.body.meta.total).toBe('number');
    });

    it('works across all fact types (UNION over eight tables)', async () => {
      const res = await api()
        .get('/api/v1/verification/queue?limit=100')
        .set(bearer(verifier))
        .expect(200);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('rejects an unknown fact type filter', async () => {
      await api()
        .get('/api/v1/verification/queue?entityType=users')
        .set(bearer(verifier))
        .expect(400);
    });
  });

  describe('verify and prefer', () => {
    it('does not let a contributor verify', async () => {
      await api()
        .patch(`/api/v1/population/${r1}/verify`)
        .set(bearer(contributor))
        .expect(403);
    });

    it('verifies a pending record', async () => {
      const res = await api()
        .patch(`/api/v1/population/${r1}/verify`)
        .set(bearer(verifier))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'VERIFIED',
        verifiedById: verifier.id,
      });
      expect(res.body.verifiedAt).toBeTruthy();
    });

    it('answers 409 when it is verified twice', async () => {
      await api()
        .patch(`/api/v1/population/${r1}/verify`)
        .set(bearer(verifier))
        .expect(409);
    });

    it('does not allow a record that is not VERIFIED to be preferred', async () => {
      await api()
        .patch(`/api/v1/population/${r2}/prefer`)
        .set(bearer(verifier))
        .expect(409);
    });

    it('prefers one figure, then switches the preferred figure of the year', async () => {
      await api()
        .patch(`/api/v1/population/${r1}/prefer`)
        .set(bearer(verifier))
        .expect(200);
      await api()
        .patch(`/api/v1/population/${r2}/verify`)
        .set(bearer(verifier))
        .expect(200);
      const res = await api()
        .patch(`/api/v1/population/${r2}/prefer`)
        .set(bearer(verifier))
        .expect(200);
      expect(res.body.isPreferred).toBe(true);

      // exactly one preferred figure per village and year (database index)
      const preferred = await prisma.populationRecord.count({
        where: { villageId: VILLAGE, year: YEAR, isPreferred: true },
      });
      expect(preferred).toBe(1);

      const list = await api()
        .get(`/api/v1/villages/${VILLAGE}/population`)
        .expect(200);
      const entry = list.body.find((y: { year: number }) => y.year === YEAR);
      expect(entry.preferred.id).toBe(r2);
      expect(entry.alternatives.map((a: { id: number }) => a.id)).toEqual([r1]);
      expect(entry.alternatives[0].isPreferred).toBe(false);
    });

    it('works through the generic route too', async () => {
      await api()
        .patch(`/api/v1/verification/population-records/${r2}/prefer`)
        .set(bearer(verifier))
        .expect(200);
    });

    it('answers 404 for an unknown fact type', async () => {
      await api()
        .patch('/api/v1/verification/users/1/verify')
        .set(bearer(verifier))
        .expect(404);
    });
  });

  describe('reject', () => {
    it('needs a reason, then rejects and hides the record', async () => {
      const created = await postPopulation(contributor, {
        year: REJECT_YEAR,
        population: 400,
        sourceId: sourceA,
      }).expect(201);
      rejected = created.body.record.id;

      await api()
        .patch(`/api/v1/population/${rejected}/reject`)
        .set(bearer(verifier))
        .send({})
        .expect(400);
      const res = await api()
        .patch(`/api/v1/population/${rejected}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'Not supported by the source' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Not supported by the source',
      });

      const list = await api()
        .get(`/api/v1/villages/${VILLAGE}/population`)
        .expect(200);
      expect(list.body.map((y: { year: number }) => y.year)).not.toContain(
        REJECT_YEAR,
      );

      await api()
        .patch(`/api/v1/population/${rejected}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'again' })
        .expect(409);
    });
  });

  describe('four-eyes rule', () => {
    it('stops a verifier from reviewing their own submission, but another reviewer can', async () => {
      const created = await postPopulation(verifier, {
        year: OWN_YEAR,
        population: 300,
        sourceId: sourceA,
      }).expect(201);
      const own = created.body.record.id;

      const res = await api()
        .patch(`/api/v1/population/${own}/verify`)
        .set(bearer(verifier))
        .expect(403);
      expect(res.body.message).toMatch(/submitted yourself/);
      await api()
        .patch(`/api/v1/population/${own}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'x' })
        .expect(403);

      // the verifier's own submission is not in the verifier's queue ...
      const mine = await api()
        .get('/api/v1/verification/queue?limit=100')
        .set(bearer(verifier))
        .expect(200);
      expect(mine.body.data.map((i: { id: number }) => i.id)).not.toContain(
        own,
      );
      // ... but it is in the admin's queue
      const theirs = await api()
        .get('/api/v1/verification/queue?limit=100')
        .set(bearer(admin))
        .expect(200);
      expect(theirs.body.data.map((i: { id: number }) => i.id)).toContain(own);

      const ok = await api()
        .patch(`/api/v1/population/${own}/verify`)
        .set(bearer(admin))
        .expect(200);
      expect(ok.body).toMatchObject({
        status: 'VERIFIED',
        verifiedById: admin.id,
      });
    });
  });

  describe('plausibility warnings', () => {
    it('saves an implausible jump but warns about it', async () => {
      const res = await postPopulation(contributor, {
        year: WARN_YEAR,
        population: 900000,
        sourceId: sourceA,
      }).expect(201);
      expect(res.body.record.status).toBe('PENDING');
      expect(res.body.warnings[0]).toMatch(
        /per year compared with 1300 in 1650/,
      );
    });
  });

  describe('GET /reports/population-trends', () => {
    it('sums one verified figure per village and year', async () => {
      const res = await api()
        .get(`/api/v1/reports/population-trends?governorate=${GOVERNORATE}`)
        .expect(200);
      expect(res.body.governorate).toBe(GOVERNORATE);
      const byYear = Object.fromEntries(
        res.body.data.map((r: { year: number }) => [r.year, r]),
      );
      // YEAR: the preferred figure (source B, 1300) counts once, not 1200 + 1300
      expect(byYear[YEAR]).toEqual({
        year: YEAR,
        totalPopulation: 1300,
        villagesCount: 1,
      });
      // verified by the admin
      expect(byYear[OWN_YEAR]).toEqual({
        year: OWN_YEAR,
        totalPopulation: 300,
        villagesCount: 1,
      });
      // pending and rejected figures are not counted
      expect(byYear[WARN_YEAR]).toBeUndefined();
      expect(byYear[REJECT_YEAR]).toBeUndefined();
    });

    it('covers all governorates when none is given, including the seeded years', async () => {
      const res = await api()
        .get('/api/v1/reports/population-trends')
        .expect(200);
      const years = res.body.data.map((r: { year: number }) => r.year);
      expect(years).toEqual(expect.arrayContaining([2017, YEAR]));
      // seeded figures of Sebastia (3200 or 3350, depending on which is preferred) at least
      const y2017 = res.body.data.find(
        (r: { year: number }) => r.year === 2017,
      );
      expect(y2017.totalPopulation).toBeGreaterThanOrEqual(3200);
      expect(y2017.villagesCount).toBeGreaterThanOrEqual(1);
    });

    it('answers 404 for an unknown governorate', async () => {
      await api()
        .get('/api/v1/reports/population-trends?governorate=Atlantis')
        .expect(404);
    });

    it('accepts the Arabic name too', async () => {
      const res = await api()
        .get(
          `/api/v1/reports/population-trends?governorate=${encodeURIComponent('بيت لحم')}`,
        )
        .expect(200);
      expect(res.body.data.map((r: { year: number }) => r.year)).toContain(
        YEAR,
      );
    });
  });

  describe('audit log', () => {
    const auditOf = async (entityType: string, entityId: number) => {
      const res = await api()
        .get(`/api/v1/audit-logs?entityType=${entityType}&entityId=${entityId}`)
        .set(bearer(admin))
        .expect(200);
      return res.body as {
        action: string;
        userId: number;
        beforeData: Record<string, unknown> | null;
        afterData: Record<string, unknown> | null;
      }[];
    };

    it('records who created, verified and preferred a population record', async () => {
      const logs = await auditOf('population_record', r2);
      expect(logs.map((l) => l.action).sort()).toEqual(
        ['CREATE', 'SET_PREFERRED', 'VERIFY'].sort(),
      );

      const verify = logs.find((l) => l.action === 'VERIFY');
      expect(verify?.userId).toBe(verifier.id);
      expect(verify?.beforeData).toMatchObject({ status: 'PENDING' });
      expect(verify?.afterData).toMatchObject({ status: 'VERIFIED' });

      // the old preferred figure is remembered
      const prefer = logs.find((l) => l.action === 'SET_PREFERRED');
      expect(prefer?.beforeData).toMatchObject({ previousPreferredId: r1 });
    });

    it('records the rejection with its reason', async () => {
      const logs = await auditOf('population_record', rejected);
      const reject = logs.find((l) => l.action === 'REJECT');
      expect(reject?.afterData).toMatchObject({
        rejectionReason: 'Not supported by the source',
      });
    });
  });
});
