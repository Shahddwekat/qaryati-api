import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Names and relationships of a village, with review through the shared
 * verification endpoints. Everything created here is removed at the end;
 * seeded rows are never changed.
 */
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
const PREFIX = 'e2efacts';

describe('Village names and relations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
  const relationIds: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const role of ['contributor', 'verifier']) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: `${role}@qaryati.local`, password: PASSWORD })
        .expect(201);
      tokens[role] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    const names = await prisma.villageName.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          {
            entityType: 'village_name',
            entityId: { in: names.map((n) => n.id) },
          },
          { entityType: 'village_relation', entityId: { in: relationIds } },
        ],
      },
    });
    await prisma.villageName.deleteMany({
      where: { id: { in: names.map((n) => n.id) } },
    });
    await prisma.villageRelation.deleteMany({
      where: { id: { in: relationIds } },
    });
    await app.close();
  });

  describe('names', () => {
    it('lists the names of a village (public)', async () => {
      const res = await api().get('/api/v1/villages/1/names').expect(200);
      expect(res.body.map((n: { name: string }) => n.name)).toEqual(
        expect.arrayContaining(['سبسطية', 'Sebastia']),
      );
    });

    it('adds a historical name as PENDING, finds it by search, and a verifier verifies it', async () => {
      const created = await api()
        .post('/api/v1/villages/1/names')
        .set(as('contributor'))
        .send({
          name: `${PREFIX}samaria`,
          language: 'EN',
          type: 'HISTORICAL',
          periodNote: 'Roman era',
          sourceId: 1,
        })
        .expect(201);
      expect(created.body.status).toBe('PENDING');

      // PENDING names are public (ADR-0005), so search already finds the village.
      const search = await api()
        .get('/api/v1/villages')
        .query({ q: `${PREFIX}sam` })
        .expect(200);
      expect(search.body.data.map((v: { id: number }) => v.id)).toEqual([1]);

      await api()
        .patch(`/api/v1/verification/village-names/${created.body.id}/verify`)
        .set(as('verifier'))
        .expect(200);

      const names = await api().get('/api/v1/villages/1/names').expect(200);
      const samaria = names.body.find(
        (n: { id: number }) => n.id === created.body.id,
      );
      expect(samaria).toMatchObject({
        status: 'VERIFIED',
        periodNote: 'Roman era',
        source: { id: 1 },
      });
    });

    it('returns 400 for a historical name without a source, 409 for a duplicate, 401 without a token', async () => {
      const body = {
        name: `${PREFIX}dup`,
        language: 'EN',
        type: 'TRANSLITERATION',
      };
      await api()
        .post('/api/v1/villages/1/names')
        .set(as('contributor'))
        .send({ ...body, type: 'HISTORICAL' })
        .expect(400);
      await api()
        .post('/api/v1/villages/1/names')
        .set(as('contributor'))
        .send(body)
        .expect(201);
      await api()
        .post('/api/v1/villages/1/names')
        .set(as('contributor'))
        .send(body)
        .expect(409);
      await api().post('/api/v1/villages/1/names').send(body).expect(401);
    });
  });

  describe('relations', () => {
    it('adds a relation and shows it on both villages', async () => {
      const created = await api()
        .post('/api/v1/villages/3/relations')
        .set(as('contributor'))
        .send({
          relatedVillageId: 1,
          type: 'SPLIT_FROM',
          year: 1965,
          sourceId: 1,
        })
        .expect(201);
      relationIds.push(created.body.id);
      expect(created.body.status).toBe('PENDING');

      const from3 = await api().get('/api/v1/villages/3/relations').expect(200);
      expect(from3.body[0]).toMatchObject({
        direction: 'OUTGOING',
        type: 'SPLIT_FROM',
        year: 1965,
        otherVillage: { id: 1 },
      });

      const from1 = await api().get('/api/v1/villages/1/relations').expect(200);
      expect(from1.body[0]).toMatchObject({
        direction: 'INCOMING',
        otherVillage: { id: 3 },
      });
    });

    it('returns 409 for the same relation and for the opposite relation', async () => {
      await api()
        .post('/api/v1/villages/3/relations')
        .set(as('contributor'))
        .send({ relatedVillageId: 1, type: 'SPLIT_FROM', sourceId: 1 })
        .expect(409);
      await api()
        .post('/api/v1/villages/1/relations')
        .set(as('contributor'))
        .send({ relatedVillageId: 3, type: 'SPLIT_FROM', sourceId: 1 })
        .expect(409);
    });

    it.each([
      ['a relation to itself', 1, { relatedVillageId: 1 }, 400],
      ['a future year', 2, { relatedVillageId: 1, year: 2999 }, 400],
      ['an unknown related village', 2, { relatedVillageId: 99999 }, 404],
      [
        'a missing source',
        2,
        { relatedVillageId: 1, sourceId: undefined },
        400,
      ],
    ])('rejects %s', async (_name, villageId, over, status) => {
      await api()
        .post(`/api/v1/villages/${villageId}/relations`)
        .set(as('contributor'))
        .send({ type: 'MERGED_WITH', sourceId: 1, ...over })
        .expect(status);
    });
  });
});
