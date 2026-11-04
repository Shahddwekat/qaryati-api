import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** Every error has the same body and every response has a request id. */
describe('Error format and request id (e2e)', () => {
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());

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

  const shape = (status: number, error: string) => ({
    statusCode: status,
    error,
    message: expect.anything(),
    path: expect.stringMatching(/^\/api\/v1\//),
    timestamp: expect.any(String),
    requestId: expect.any(String),
  });

  it('404 for an unknown route', async () => {
    const res = await api().get('/api/v1/no-such-route').expect(404);
    expect(res.body).toEqual(shape(404, 'Not Found'));
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('404 for an unknown village', async () => {
    const res = await api().get('/api/v1/villages/999999').expect(404);
    expect(res.body).toEqual(shape(404, 'Not Found'));
  });

  it('400 for invalid query parameters, with the list of problems', async () => {
    const res = await api()
      .get('/api/v1/villages')
      .query({ limit: 'abc' })
      .expect(400);
    expect(res.body).toEqual(shape(400, 'Bad Request'));
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('400 for a body that is not valid JSON', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body).toEqual(shape(400, 'Bad Request'));
  });

  it('401 without a token', async () => {
    const res = await api().post('/api/v1/villages').send({}).expect(401);
    expect(res.body).toEqual(shape(401, 'Unauthorized'));
  });

  it('keeps the request id sent by the client', async () => {
    const res = await api()
      .get('/api/v1/villages/999999')
      .set('X-Request-Id', 'my-trace-1')
      .expect(404);
    expect(res.headers['x-request-id']).toBe('my-trace-1');
    expect(res.body.requestId).toBe('my-trace-1');
  });

  it('adds a request id to successful responses too', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
