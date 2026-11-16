import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { setupSwagger } from '../src/swagger';

interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  responses: Record<string, unknown>;
}
type Paths = Record<string, Record<string, Operation>>;

/**
 * The Swagger document of the heritage module (landmarks, historical events,
 * cultural traits, economic activities and facilities): every endpoint has a
 * summary and a description and lists its error responses.
 *
 * Not tested here: the DTO property descriptions (the /** comments *\/). They are
 * added by the @nestjs/swagger CLI plugin, which only runs in `nest build`, not in
 * these tests. Check them in the running app at /api/docs.
 */
describe('Swagger docs of the heritage module (e2e)', () => {
  let app: INestApplication<App>;
  let doc: { paths: Paths };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    doc = res.body;
  });

  afterAll(async () => {
    await app.close();
  });

  // [method, path, error statuses that must be documented]
  const ENDPOINTS: [string, string, number[]][] = [
    ['get', '/api/v1/villages/{id}/landmarks', [400, 404]],
    ['post', '/api/v1/villages/{id}/landmarks', [400, 401, 403, 404]],
    ['get', '/api/v1/villages/{id}/historical-events', [400, 404]],
    ['get', '/api/v1/villages/{id}/cultural-traits', [400, 404]],
    ['post', '/api/v1/villages/{id}/cultural-traits', [400, 401, 403, 404]],
    ['get', '/api/v1/villages/{id}/economic-activities', [400, 404]],
    ['post', '/api/v1/villages/{id}/economic-activities', [400, 401, 403, 404]],
    ['get', '/api/v1/villages/{id}/facilities', [400, 404]],
    ['post', '/api/v1/villages/{id}/facilities', [400, 401, 403, 404]],
    ['post', '/api/v1/historical-events', [400, 401, 403, 404]],
  ];

  it.each(ENDPOINTS)(
    '%s %s has a summary and documents its errors',
    (method, path, errors) => {
      const op = doc.paths[path]?.[method];
      expect(op).toBeDefined();
      expect(op.tags).toContain('heritage');
      expect(op.summary?.length).toBeGreaterThan(10);
      expect(op.description?.length).toBeGreaterThan(20);
      for (const status of errors) {
        expect(Object.keys(op.responses)).toContain(String(status));
      }
    },
  );

  it('gives every heritage operation a summary (future endpoints too)', () => {
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (op.tags?.includes('heritage')) {
          expect({ method, path, summary: !!op.summary }).toEqual({
            method,
            path,
            summary: true,
          });
        }
      }
    }
  });
});
