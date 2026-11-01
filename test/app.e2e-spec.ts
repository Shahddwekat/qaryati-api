import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Runs the real app against the real database (seeded with `npx prisma db seed`).
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports the database as up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('POST /api/v1/auth/login works for a seeded user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'contributor@qaryati.local',
        password: process.env.SEED_USER_PASSWORD ?? 'Password123!',
      })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('CONTRIBUTOR');
  });

  it('GET /api/v1/users/me rejects a request without a token', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET /api/v1/sources is public and paginated', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sources?limit=1')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
  });

  it('rejects unknown fields in the request body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.c', password: 'x', role: 'ADMIN' })
      .expect(400);
  });
});
