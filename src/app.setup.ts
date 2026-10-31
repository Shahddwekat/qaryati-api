import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Global app settings, shared by main.ts and the e2e tests,
 * so the tests run the API exactly as it runs in production.
 */
export function configureApp(app: INestApplication): void {
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
}
