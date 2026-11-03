import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Read endpoints for governorates and villages, against the seeded database
 * (16 governorates, 6 villages). Only village 3 is hidden temporarily, and it is
 * always restored at the end.
 */
describe('Villages and governorates (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  const HIDDEN = 3;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.village.update({
      where: { id: HIDDEN },
      data: { deletedAt: null },
    });
    await app.close();
  });

  describe('GET /api/v1/governorates', () => {
    it('lists all 16 governorates with village counts', async () => {
      const res = await api().get('/api/v1/governorates').expect(200);

      expect(res.body).toHaveLength(16);
      const nablus = res.body.find(
        (g: { nameEn: string }) => g.nameEn === 'Nablus',
      );
      expect(nablus).toMatchObject({ nameAr: 'نابلس', villagesCount: 2 });
    });

    it('returns 404 for the municipalities of an unknown governorate', () => {
      return api().get('/api/v1/governorates/9999/municipalities').expect(404);
    });
  });

  describe('GET /api/v1/villages', () => {
    it('is public, paginated and sorted by English name by default', async () => {
      const res = await api().get('/api/v1/villages?limit=2').expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 6 });
      expect(res.body.data.map((v: { nameEn: string }) => v.nameEn)).toEqual([
        'Battir',
        'Burqa',
      ]);
      expect(typeof res.body.data[0].latitude).toBe('number');
    });

    it('filters by governorate', async () => {
      const govs = await api().get('/api/v1/governorates').expect(200);
      const nablus = govs.body.find(
        (g: { nameEn: string }) => g.nameEn === 'Nablus',
      );

      const res = await api()
        .get(`/api/v1/villages?governorateId=${nablus.id}`)
        .expect(200);

      expect(res.body.meta.total).toBe(2);
      for (const v of res.body.data) {
        expect(v.governorate.nameEn).toBe('Nablus');
      }
    });

    it('sorts by Arabic name', async () => {
      const res = await api()
        .get('/api/v1/villages?sortBy=nameAr&order=asc')
        .expect(200);

      expect(res.body.data[0].nameAr).toBe('الطيبة');
    });

    it.each([
      ['an unknown sort field', 'sortBy=deletedAt'],
      ['a limit above 100', 'limit=500'],
      ['an unknown parameter', 'foo=1'],
    ])('rejects %s with 400', (_name, qs) => {
      return api().get(`/api/v1/villages?${qs}`).expect(400);
    });
  });

  describe('GET /api/v1/villages/:id', () => {
    it('returns the village with its governorate and names', async () => {
      const res = await api().get('/api/v1/villages/1').expect(200);

      expect(res.body).toMatchObject({
        id: 1,
        nameAr: 'سبسطية',
        nameEn: 'Sebastia',
        governorate: { nameEn: 'Nablus' },
      });
      expect(res.body.names.map((n: { name: string }) => n.name)).toEqual(
        expect.arrayContaining(['سبسطية', 'Sebastia']),
      );
    });

    it('returns 404 for an unknown village and 400 for a non-numeric id', async () => {
      await api().get('/api/v1/villages/9999').expect(404);
      await api().get('/api/v1/villages/abc').expect(400);
    });
  });

  describe('hidden (soft-deleted) villages', () => {
    beforeAll(async () => {
      await prisma.village.update({
        where: { id: HIDDEN },
        data: { deletedAt: new Date() },
      });
    });

    it('disappear from the list and the governorate count', async () => {
      const list = await api().get('/api/v1/villages?limit=100').expect(200);
      expect(list.body.meta.total).toBe(5);
      expect(list.body.data.map((v: { id: number }) => v.id)).not.toContain(
        HIDDEN,
      );

      const govs = await api().get('/api/v1/governorates').expect(200);
      const qalqilya = govs.body.find(
        (g: { nameEn: string }) => g.nameEn === 'Qalqilya',
      );
      expect(qalqilya.villagesCount).toBe(0);
    });

    it('return 404 on the detail endpoint', () => {
      return api().get(`/api/v1/villages/${HIDDEN}`).expect(404);
    });
  });
});
