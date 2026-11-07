import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Close database connections cleanly when Docker stops the container (SIGTERM)
  app.enableShutdownHooks();
  configureApp(app);
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
