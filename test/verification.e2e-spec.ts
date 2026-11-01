import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The shared verification workflow, through real HTTP calls against the real
 * database (seeded with `npx prisma db seed`). It uses landmarks and facilities
 * (created through the heritage API) as the facts to review.
 *
 * Everything the tests create lives in village 6 with a name starting with
 * "e2e-ver" and is removed at the end. Seeded rows are never changed.
 */
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
const VILLAGE = 6;
const NAME = 'e2e-ver';

interface Session {
  token: string;
  id: number;
}

describe('Verification workflow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let contributor: Session;
  let verifier: Session;
  let admin: Session;
  let sourceId: number;

  let landmark: number; // verified by the verifier
  let facility: number; // verified by the verifier
  let toReject: number; // rejected by the verifier
  let own: number; // submitted by the verifier

  const api = () => request(app.getHttpServer());
  const bearer = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

  async function login(email: string): Promise<Session> {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { token: res.body.accessToken, id: res.body.user.id };
  }

  async function createLandmark(s: Session, suffix: string): Promise<number> {
    const res = await api()
      .post(`/api/v1/villages/${VILLAGE}/landmarks`)
      .set(bearer(s))
      .send({ nameAr: `${NAME} ${suffix}`, type: 'SPRING', sourceId })
      .expect(201);
    return res.body.id;
  }

  async function queueIds(s: Session, query = ''): Promise<number[]> {
    const res = await api()
      .get(`/api/v1/verification/queue?limit=100${query}`)
      .set(bearer(s))
      .expect(200);
    return res.body.data.map((i: { id: number }) => i.id);
  }

  async function cleanup() {
    await prisma.landmark.deleteMany({
      where: { villageId: VILLAGE, nameAr: { startsWith: NAME } },
    });
    await prisma.facility.deleteMany({
      where: { villageId: VILLAGE, name: { startsWith: NAME } },
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
    sourceId = sources.body.data[0].id;

    landmark = await createLandmark(contributor, 'landmark');
    toReject = await createLandmark(contributor, 'to reject');
    own = await createLandmark(verifier, 'own');
    const f = await api()
      .post(`/api/v1/villages/${VILLAGE}/facilities`)
      .set(bearer(contributor))
      .send({
        type: 'SCHOOL',
        name: `${NAME} facility`,
        status: 'PLANNED',
        sourceId,
      })
      .expect(201);
    facility = f.body.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('GET /verification/queue', () => {
    it('is closed to contributors and anonymous users', async () => {
      await api()
        .get('/api/v1/verification/queue')
        .set(bearer(contributor))
        .expect(403);
      await api().get('/api/v1/verification/queue').expect(401);
    });

    it('lists pending facts of several types (raw SQL UNION), oldest first', async () => {
      const res = await api()
        .get('/api/v1/verification/queue?limit=100')
        .set(bearer(verifier))
        .expect(200);
      const items = res.body.data as {
        id: number;
        entityType: string;
        type: string;
        createdAt: string;
      }[];
      const landmarkItem = items.find(
        (i) => i.entityType === 'landmark' && i.id === landmark,
      );
      const facilityItem = items.find(
        (i) => i.entityType === 'facility' && i.id === facility,
      );
      expect(landmarkItem).toMatchObject({
        type: 'landmarks',
        villageId: VILLAGE,
        submittedBy: contributor.id,
      });
      expect(landmarkItem).toHaveProperty('label', `${NAME} landmark`);
      expect(facilityItem).toMatchObject({
        type: 'facilities',
        label: `${NAME} facility`,
      });

      // JSON-safe numbers (COUNT comes back as BigInt from MySQL)
      expect(typeof res.body.meta.total).toBe('number');
      // oldest first
      const times = items.map((i) => new Date(i.createdAt).getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('filters by fact type', async () => {
      const res = await api()
        .get('/api/v1/verification/queue?entityType=facilities&limit=100')
        .set(bearer(verifier))
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every(
          (i: { entityType: string }) => i.entityType === 'facility',
        ),
      ).toBe(true);
    });

    it('paginates', async () => {
      const res = await api()
        .get('/api/v1/verification/queue?limit=1&page=1')
        .set(bearer(verifier))
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
      expect(res.body.meta.totalPages).toBe(res.body.meta.total);
    });

    it('rejects an unknown fact type and an oversized page', async () => {
      await api()
        .get('/api/v1/verification/queue?entityType=users')
        .set(bearer(verifier))
        .expect(400);
      await api()
        .get('/api/v1/verification/queue?limit=101')
        .set(bearer(verifier))
        .expect(400);
    });
  });

  describe('verify', () => {
    it('is closed to contributors', async () => {
      await api()
        .patch(`/api/v1/verification/landmarks/${landmark}/verify`)
        .set(bearer(contributor))
        .expect(403);
    });

    it('verifies a pending fact and records the reviewer', async () => {
      const res = await api()
        .patch(`/api/v1/verification/landmarks/${landmark}/verify`)
        .set(bearer(verifier))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'VERIFIED',
        verifiedById: verifier.id,
      });
      expect(res.body.verifiedAt).toBeTruthy();
      expect(await queueIds(verifier, '&entityType=landmarks')).not.toContain(
        landmark,
      );
    });

    it('answers 409 when it is verified twice', async () => {
      await api()
        .patch(`/api/v1/verification/landmarks/${landmark}/verify`)
        .set(bearer(verifier))
        .expect(409);
    });

    it('verifies a facility without touching its operational status', async () => {
      const res = await api()
        .patch(`/api/v1/verification/facilities/${facility}/verify`)
        .set(bearer(verifier))
        .expect(200);
      expect(res.body.verificationStatus).toBe('VERIFIED');
      expect(res.body.status).toBe('PLANNED');
    });

    it('answers 404 for a missing fact, an unknown type, and 400 for a bad id', async () => {
      await api()
        .patch('/api/v1/verification/landmarks/999999/verify')
        .set(bearer(verifier))
        .expect(404);
      const res = await api()
        .patch('/api/v1/verification/users/1/verify')
        .set(bearer(verifier))
        .expect(404);
      expect(res.body.message).toMatch(/Use one of: .*landmarks/);
      await api()
        .patch('/api/v1/verification/landmarks/abc/verify')
        .set(bearer(verifier))
        .expect(400);
    });
  });

  describe('reject', () => {
    it('needs a reason', async () => {
      await api()
        .patch(`/api/v1/verification/landmarks/${toReject}/reject`)
        .set(bearer(verifier))
        .send({})
        .expect(400);
      await api()
        .patch(`/api/v1/verification/landmarks/${toReject}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'x'.repeat(501) })
        .expect(400);
    });

    it('rejects with a reason, removes it from the queue, and is final', async () => {
      const res = await api()
        .patch(`/api/v1/verification/landmarks/${toReject}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'Wrong village' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Wrong village',
      });
      expect(await queueIds(verifier, '&entityType=landmarks')).not.toContain(
        toReject,
      );

      await api()
        .patch(`/api/v1/verification/landmarks/${toReject}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'again' })
        .expect(409);
      // a rejected fact cannot be brought back by verifying it
      await api()
        .patch(`/api/v1/verification/landmarks/${toReject}/verify`)
        .set(bearer(verifier))
        .expect(409);
    });
  });

  describe('prefer', () => {
    it('is refused for facts that have no "preferred" concept', async () => {
      const res = await api()
        .patch(`/api/v1/verification/landmarks/${landmark}/prefer`)
        .set(bearer(verifier))
        .expect(400);
      expect(res.body.message).toMatch(/does not support a preferred value/);
    });
  });

  describe('four-eyes rule', () => {
    it('stops a reviewer from reviewing their own submission', async () => {
      const res = await api()
        .patch(`/api/v1/verification/landmarks/${own}/verify`)
        .set(bearer(verifier))
        .expect(403);
      expect(res.body.message).toMatch(/submitted yourself/);
      await api()
        .patch(`/api/v1/verification/landmarks/${own}/reject`)
        .set(bearer(verifier))
        .send({ reason: 'x' })
        .expect(403);
    });

    it('keeps it out of their own queue but shows it to another reviewer', async () => {
      expect(await queueIds(verifier, '&entityType=landmarks')).not.toContain(
        own,
      );
      expect(await queueIds(admin, '&entityType=landmarks')).toContain(own);
    });

    it('lets another reviewer (the admin) verify it', async () => {
      const res = await api()
        .patch(`/api/v1/verification/landmarks/${own}/verify`)
        .set(bearer(admin))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'VERIFIED',
        verifiedById: admin.id,
      });
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

    it('records who verified, with before and after', async () => {
      const verify = (await auditOf('landmark', landmark)).find(
        (l) => l.action === 'VERIFY',
      );
      expect(verify?.userId).toBe(verifier.id);
      expect(verify?.beforeData).toMatchObject({ status: 'PENDING' });
      expect(verify?.afterData).toMatchObject({
        status: 'VERIFIED',
        verifiedById: verifier.id,
      });
    });

    it('records a rejection with its reason', async () => {
      const reject = (await auditOf('landmark', toReject)).find(
        (l) => l.action === 'REJECT',
      );
      expect(reject?.afterData).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Wrong village',
      });
    });

    it('uses snake_case entity names and writes nothing for refused attempts', async () => {
      expect(
        (await auditOf('facility', facility)).map((l) => l.action),
      ).toContain('VERIFY');
      // the verifier's refused attempts on their own landmark left no VERIFY/REJECT by the verifier
      const byVerifier = (await auditOf('landmark', own)).filter(
        (l) => l.userId === verifier.id,
      );
      expect(byVerifier.map((l) => l.action)).not.toContain('VERIFY');
      expect(byVerifier.map((l) => l.action)).not.toContain('REJECT');
    });
  });
});
