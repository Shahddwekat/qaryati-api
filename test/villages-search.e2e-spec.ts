import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Native-SQL features against the seeded database: FULLTEXT name search and
 * nearby villages (ADR-0006). Seed coordinates: Sebastia (1) is ~2.75 km from
 * Burqa (2) and ~9.2 km from Kafr Qaddum (3); Jifna and Taybeh are ~35 km away.
 */
describe('Village search and nearby villages (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  const names = (res: request.Response) =>
    res.body.data.map((v: { nameEn: string }) => v.nameEn);

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
      where: { id: 2 },
      data: { deletedAt: null },
    });
    await app.close();
  });

  describe('GET /api/v1/villages?q=', () => {
    it.each([
      ['a full Arabic name', 'سبسطية', 'Sebastia'],
      ['an Arabic prefix', 'سبس', 'Sebastia'],
      ['an English prefix', 'Burq', 'Burqa'],
      ['the second word of a name', 'qaddum', 'Kafr Qaddum'],
    ])('finds a village by %s', async (_name, q, expected) => {
      const res = await api().get('/api/v1/villages').query({ q }).expect(200);
      expect(names(res)[0]).toBe(expected);
    });

    it('returns an empty page when nothing matches', async () => {
      const res = await api()
        .get('/api/v1/villages')
        .query({ q: 'zzzzz' })
        .expect(200);
      expect(res.body).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('ignores boolean-mode operators in the input', async () => {
      const res = await api()
        .get('/api/v1/villages')
        .query({ q: '+bur* -("x")' })
        .expect(200);
      expect(names(res)).toEqual(['Burqa']);
    });

    it('combines search with the governorate filter', async () => {
      const govs = await api().get('/api/v1/governorates').expect(200);
      const bethlehem = govs.body.find(
        (g: { nameEn: string }) => g.nameEn === 'Bethlehem',
      );
      const res = await api()
        .get('/api/v1/villages')
        .query({ q: 'Sebastia', governorateId: bethlehem.id })
        .expect(200);
      expect(res.body.meta.total).toBe(0);
    });

    it('returns 400 when q has no word of 3 or more letters', async () => {
      await api().get('/api/v1/villages').query({ q: 'ab' }).expect(400);
      await api().get('/api/v1/villages').query({ q: 'x' }).expect(400);
    });
  });

  describe('GET /api/v1/villages/:id/nearby', () => {
    it('lists villages within 10 km, nearest first, with distances', async () => {
      const res = await api().get('/api/v1/villages/1/nearby').expect(200);

      expect(res.body.village).toMatchObject({ id: 1, nameEn: 'Sebastia' });
      expect(names(res)).toEqual(['Burqa', 'Kafr Qaddum']);
      expect(res.body.data[0].distanceKm).toBeCloseTo(2.75, 1);
      expect(res.body.data[1].distanceKm).toBeCloseTo(9.2, 0);
    });

    it('respects radiusKm and limit, and never includes the village itself', async () => {
      const wide = await api()
        .get('/api/v1/villages/1/nearby?radiusKm=50')
        .expect(200);
      expect(names(wide)).toEqual(
        expect.arrayContaining(['Burqa', 'Kafr Qaddum', 'Jifna', 'Taybeh']),
      );
      expect(names(wide)).not.toContain('Sebastia');

      const one = await api()
        .get('/api/v1/villages/1/nearby?radiusKm=50&limit=1')
        .expect(200);
      expect(names(one)).toEqual(['Burqa']);
    });

    it('leaves hidden villages out', async () => {
      await prisma.village.update({
        where: { id: 2 },
        data: { deletedAt: new Date() },
      });
      const res = await api().get('/api/v1/villages/1/nearby').expect(200);
      expect(names(res)).toEqual(['Kafr Qaddum']);
      await prisma.village.update({
        where: { id: 2 },
        data: { deletedAt: null },
      });
    });

    it('returns 400 for a radius above 50 km and 404 for an unknown village', async () => {
      await api().get('/api/v1/villages/1/nearby?radiusKm=500').expect(400);
      await api().get('/api/v1/villages/9999/nearby').expect(404);
    });
  });
});
