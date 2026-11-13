import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** Login rate limiting: LOGIN_RATE_LIMIT attempts per window, then 429. */
describe('Login rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  const saved = process.env.LOGIN_RATE_LIMIT;

  beforeAll(async () => {
    // A small limit for this test; the guard reads it when the app starts.
    process.env.LOGIN_RATE_LIMIT = '3';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.LOGIN_RATE_LIMIT;
    else process.env.LOGIN_RATE_LIMIT = saved;
    await app.close();
  });

  const login = (password: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'contributor@qaryati.local', password });

  it('answers 429 after too many attempts, also for the right password', async () => {
    await login('wrong-password-1').expect(401);
    await login('wrong-password-2').expect(401);
    await login('wrong-password-3').expect(401);

    const res = await login(
      process.env.SEED_USER_PASSWORD ?? 'Password123!',
    ).expect(429);

    expect(res.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: expect.stringContaining('Too many login attempts'),
    });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
