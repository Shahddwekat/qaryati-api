import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

/**
 * Global app settings, shared by main.ts and the e2e tests,
 * so the tests run the API exactly as it runs in production.
 */
export function configureApp(app: INestApplication): void {
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
