import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { setupSwagger } from '../src/swagger';
import { ENTITY_SLUG_LIST } from '../src/verification/verification.types';

interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: { name: string; in: string; schema?: { enum?: string[] } }[];
  responses: Record<string, unknown>;
}
type Paths = Record<string, Record<string, Operation>>;

/**
 * The Swagger document of the sources, verification and population modules:
 * every endpoint has a summary and lists its error responses, and the
 * verification endpoints explain the four-eyes rule and the allowed fact types.
 *
 * Not tested here: the DTO property descriptions (the /** comments *\/). They are
 * added by the @nestjs/swagger CLI plugin, which only runs in `nest build`, not in
 * these tests. Check them in the running app at /api/docs.
 */
describe('Swagger docs of sources, verification and population (e2e)', () => {
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
    ['get', '/api/v1/sources', [400]],
    ['get', '/api/v1/sources/{id}', [400, 404]],
    ['post', '/api/v1/sources', [400, 401, 403, 409]],
    ['patch', '/api/v1/sources/{id}', [400, 401, 403, 404, 409]],
    ['get', '/api/v1/verification/queue', [400, 401, 403]],
    [
      'patch',
      '/api/v1/verification/{entityType}/{id}/verify',
      [400, 401, 403, 404, 409],
    ],
    [
      'patch',
      '/api/v1/verification/{entityType}/{id}/reject',
      [400, 401, 403, 404, 409],
    ],
    [
      'patch',
      '/api/v1/verification/{entityType}/{id}/prefer',
      [400, 401, 403, 404, 409],
    ],
    ['get', '/api/v1/villages/{id}/population', [400, 404]],
    ['post', '/api/v1/villages/{id}/population', [400, 401, 403, 404, 409]],
    ['patch', '/api/v1/population/{id}/verify', [400, 401, 403, 404, 409]],
    ['patch', '/api/v1/population/{id}/reject', [400, 401, 403, 404, 409]],
    ['patch', '/api/v1/population/{id}/prefer', [400, 401, 403, 404, 409]],
    ['get', '/api/v1/reports/population-trends', [400, 404]],
  ];

  it.each(ENDPOINTS)(
    '%s %s has a summary and documents its errors',
    (method, path, errors) => {
      const op = doc.paths[path]?.[method];
      expect(op).toBeDefined();
      expect(op.summary?.length).toBeGreaterThan(10);
      expect(op.description?.length).toBeGreaterThan(20);
      for (const status of errors) {
        expect(Object.keys(op.responses)).toContain(String(status));
      }
    },
  );

  it('documents the allowed entityType values on the verification endpoints', () => {
    for (const action of ['verify', 'reject', 'prefer']) {
      const op =
        doc.paths[`/api/v1/verification/{entityType}/{id}/${action}`].patch;
      const param = op.parameters?.find((p) => p.name === 'entityType');
      expect(param?.schema?.enum).toEqual(ENTITY_SLUG_LIST);
    }
    const queue = doc.paths['/api/v1/verification/queue'].get;
    for (const slug of ENTITY_SLUG_LIST) {
      expect(queue.description).toContain(slug);
    }
  });

  it('explains the four-eyes rule where a fact is reviewed', () => {
    const reviewing = [
      '/api/v1/verification/{entityType}/{id}/verify',
      '/api/v1/verification/{entityType}/{id}/reject',
      '/api/v1/population/{id}/verify',
      '/api/v1/population/{id}/reject',
    ];
    for (const path of reviewing) {
      expect(doc.paths[path].patch.description).toMatch(/four-eyes/i);
      expect(doc.paths[path].patch.description).toContain('403');
    }
    expect(doc.paths['/api/v1/verification/queue'].get.description).toMatch(
      /four-eyes/i,
    );
  });

  it('gives every operation of these modules a summary (future endpoints too)', () => {
    const tags = new Set(['sources', 'verification', 'population']);
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (op.tags?.some((t) => tags.has(t))) {
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
