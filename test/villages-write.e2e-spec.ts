import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { GeocodingService } from '../src/geocoding/geocoding.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Create / update / hide / restore villages through real HTTP calls and the
 * real database. The geocoding provider is replaced by a fake, so the tests
 * never call the internet. Every village created here starts with "e2e-vil"
 * and is removed at the end, together with its names and audit rows.
 */
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
const PREFIX = 'e2e-vil';

const fakeGeocoding = {
  geocode: async (query: string) => {
    if (query.startsWith(`${PREFIX} geo`)) {
      return { latitude: 31.9, longitude: 35.2, displayName: query };
    }
    if (query.startsWith(`${PREFIX} abroad`)) {
      return { latitude: 48.2, longitude: 16.37, displayName: 'Vienna' };
    }
    return null;
  },
};

describe('Villages write endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};
  let governorateId: number;
  const created: number[] = [];

  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

  const body = (suffix: string, over: Record<string, unknown> = {}) => ({
    nameAr: `${PREFIX} ${suffix}`,
    nameEn: `${PREFIX} ${suffix}`,
    governorateId,
    latitude: 31.93,
    longitude: 35.16,
    ...over,
  });

  async function create(suffix: string, over: Record<string, unknown> = {}) {
    const res = await api()
      .post('/api/v1/villages')
      .set(as('verifier'))
      .send(body(suffix, over))
      .expect(201);
    created.push(res.body.id);
    return res.body;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeocodingService)
      .useValue(fakeGeocoding)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const role of ['contributor', 'verifier', 'admin']) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: `${role}@qaryati.local`, password: PASSWORD })
        .expect(201);
      tokens[role] = res.body.accessToken;
    }
    const ramallah = await prisma.governorate.findFirstOrThrow({
      where: { nameEn: 'Ramallah and Al-Bireh' },
    });
    governorateId = ramallah.id;
  });

  afterAll(async () => {
    const villages = await prisma.village.findMany({
      where: { nameEn: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = villages.map((v) => v.id);
    await prisma.auditLog.deleteMany({
      where: { entityType: 'village', entityId: { in: ids } },
    });
    await prisma.villageName.deleteMany({ where: { villageId: { in: ids } } });
    await prisma.village.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  describe('POST /api/v1/villages', () => {
    it('requires a token (401) and a VERIFIER or ADMIN role (403)', async () => {
      await api().post('/api/v1/villages').send(body('anon')).expect(401);
      await api()
        .post('/api/v1/villages')
        .set(as('contributor'))
        .send(body('contrib'))
        .expect(403);
    });

    it('creates a village with PENDING official names and an audit row', async () => {
      const village = await create('one', { areaDunum: 1500.5 });

      expect(village).toMatchObject({
        nameEn: `${PREFIX} one`,
        latitude: 31.93,
        longitude: 35.16,
        areaDunum: 1500.5,
      });
      expect(
        village.names.map((n: { type: string; status: string }) => [
          n.type,
          n.status,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ['CURRENT', 'PENDING'],
          ['ENGLISH', 'PENDING'],
        ]),
      );

      const audit = await prisma.auditLog.findFirst({
        where: { entityType: 'village', entityId: village.id },
      });
      expect(audit?.action).toBe('CREATE');

      await api().get(`/api/v1/villages/${village.id}`).expect(200);
    });

    it('geocodes the village when coordinates are missing', async () => {
      const village = await create('geo', {
        latitude: undefined,
        longitude: undefined,
      });
      expect(village).toMatchObject({ latitude: 31.9, longitude: 35.2 });
    });

    it('returns 422 when geocoding finds nothing or a place abroad', async () => {
      for (const suffix of ['nowhere', 'abroad']) {
        await api()
          .post('/api/v1/villages')
          .set(as('verifier'))
          .send(body(suffix, { latitude: undefined, longitude: undefined }))
          .expect(422);
      }
    });

    it.each([
      ['only one coordinate', { longitude: undefined }],
      ['an unknown governorate', { governorateId: 99999 }],
      ['a latitude out of range', { latitude: 120 }],
      ['an unknown field', { deletedAt: '2026-01-01' }],
    ])('returns 400 for %s', async (_name, over) => {
      await api()
        .post('/api/v1/villages')
        .set(as('verifier'))
        .send(body('bad', over))
        .expect(400);
    });

    it('returns 409 for the same Arabic name in the same governorate', async () => {
      await create('dup');
      await api()
        .post('/api/v1/villages')
        .set(as('verifier'))
        .send(body('dup'))
        .expect(409);
    });
  });

  describe('PATCH /api/v1/villages/:id', () => {
    it('updates the village and records before/after in the audit log', async () => {
      const village = await create('patch');

      const res = await api()
        .patch(`/api/v1/villages/${village.id}`)
        .set(as('verifier'))
        .send({ nameEn: `${PREFIX} patched`, elevationM: 820 })
        .expect(200);

      expect(res.body).toMatchObject({
        nameEn: `${PREFIX} patched`,
        elevationM: 820,
      });
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'village',
          entityId: village.id,
          action: 'UPDATE',
        },
      });
      expect(audit?.beforeData).toMatchObject({ nameEn: `${PREFIX} patch` });
      expect(audit?.afterData).toMatchObject({ nameEn: `${PREFIX} patched` });
    });

    it('returns 400 for an empty body and 403 for a contributor', async () => {
      const village = await create('patch-rules');
      await api()
        .patch(`/api/v1/villages/${village.id}`)
        .set(as('verifier'))
        .send({})
        .expect(400);
      await api()
        .patch(`/api/v1/villages/${village.id}`)
        .set(as('contributor'))
        .send({ elevationM: 1 })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/villages/:id and POST /api/v1/villages/:id/restore', () => {
    it('only an admin can hide and restore', async () => {
      const village = await create('roles');
      await api()
        .delete(`/api/v1/villages/${village.id}`)
        .set(as('verifier'))
        .expect(403);
      await api()
        .post(`/api/v1/villages/${village.id}/restore`)
        .set(as('verifier'))
        .expect(403);
    });

    it('hides a village (404 afterwards) and restores it', async () => {
      const village = await create('hide');

      await api()
        .delete(`/api/v1/villages/${village.id}`)
        .set(as('admin'))
        .expect(200);
      await api().get(`/api/v1/villages/${village.id}`).expect(404);
      await api()
        .delete(`/api/v1/villages/${village.id}`)
        .set(as('admin'))
        .expect(404);

      await api()
        .post(`/api/v1/villages/${village.id}/restore`)
        .set(as('admin'))
        .expect(200);
      await api().get(`/api/v1/villages/${village.id}`).expect(200);
      await api()
        .post(`/api/v1/villages/${village.id}/restore`)
        .set(as('admin'))
        .expect(409);

      const actions = await prisma.auditLog.findMany({
        where: { entityType: 'village', entityId: village.id },
        orderBy: { id: 'asc' },
        select: { action: true },
      });
      expect(actions.map((a) => a.action)).toEqual([
        'CREATE',
        'DELETE',
        'RESTORE',
      ]);
    });
  });
});
