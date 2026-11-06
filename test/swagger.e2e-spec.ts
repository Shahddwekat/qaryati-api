import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { setupSwagger } from '../src/swagger';

describe('API documentation (e2e)', () => {
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI', async () => {
    const res = await api().get('/api/docs').expect(200);
    expect(res.text).toContain('Swagger UI');
  });

  it('serves the OpenAPI document with every module and the error model', async () => {
    const res = await api().get('/api/docs-json').expect(200);
    const doc = res.body;

    expect(doc.info.title).toBe('Qaryati API');
    expect(doc.paths['/api/v1/villages']).toBeDefined();
    expect(doc.paths['/api/v1/villages/{id}/names'].post).toBeDefined();
    expect(doc.paths['/health']).toBeDefined();
    expect(doc.components.schemas.ErrorResponseDto).toBeDefined();
    expect(doc.components.securitySchemes.bearer).toBeDefined();

    const tags = new Set(
      Object.values(doc.paths).flatMap((ops) =>
        Object.values(ops as Record<string, { tags?: string[] }>).flatMap(
          (op) => op.tags ?? [],
        ),
      ),
    );
    for (const tag of [
      'auth',
      'users',
      'audit',
      'villages',
      'geography',
      'sources',
      'verification',
      'population',
      'heritage',
      'health',
    ]) {
      expect(tags).toContain(tag);
    }
  });
});
