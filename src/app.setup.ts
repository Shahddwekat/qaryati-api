import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

/**
 * Global app settings, shared by main.ts and the e2e tests,
 * so the tests run the API exactly as it runs in production.
 */
export function configureApp(app: INestApplication): void {
  // Apply HTTP security headers
  app.use(helmet());

  // Allow browser access only from configured origins
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  // Give every request an id (X-Request-Id) and log it
  app.use(requestIdMiddleware);

  // Version all API routes except the health endpoint
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  // Validate incoming request data
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Same error body for every endpoint (docs/architecture/error-model.md)
  app.useGlobalFilters(new AllExceptionsFilter());
}