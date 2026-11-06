import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponseDto } from './common/swagger/error-response.dto';

export const SWAGGER_PATH = 'api/docs';

/**
 * Interactive API documentation:
 *   http://localhost:3000/api/docs        (Swagger UI)
 *   http://localhost:3000/api/docs-json   (OpenAPI JSON, e.g. to import into API-Dog)
 *
 * Request bodies and query parameters are read from the DTO classes by the
 * @nestjs/swagger CLI plugin (nest-cli.json), including validation rules and
 * the /** comments *\/ above each property.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Qaryati API')
    .setDescription(
      'Palestinian Villages Knowledge Platform.\n\n' +
        '1. `POST /api/v1/auth/login` with a seeded account (see README).\n' +
        '2. Click **Authorize** and paste the `accessToken`.\n\n' +
        'Reading is public; the token is ignored by public endpoints. ' +
        'Every error uses the same body (`ErrorResponseDto`).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorResponseDto],
  });
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    swaggerOptions: { persistAuthorization: true },
  });
}
