import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Security headers and CORS (e2e)', () => {
  let app: INestApplication<App>;
  const saved = process.env.CORS_ORIGINS;
  const allowedOrigin = 'https://frontend.example.com';
  const unknownOrigin = 'https://unknown.example.com';

  beforeAll(async () => {
    process.env.CORS_ORIGINS = allowedOrigin;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = saved;

    await app.close();
  });

  it('returns Helmet security headers', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff');
  });

  it('allows an origin included in CORS_ORIGINS', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('Origin', allowedOrigin)
      .expect(200)
      .expect('Access-Control-Allow-Origin', allowedOrigin);
  });

  it('does not allow an unknown origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', unknownOrigin)
      .expect(200);

    expect(
      res.headers['access-control-allow-origin'],
    ).toBeUndefined();
  });
});