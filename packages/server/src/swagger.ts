import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

export const API_KEY_SCHEME = 'api-key';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('MTN Revenue Platform')
    .setDescription(
      'Orders and balanced ledger transactions per service. Machines authenticate ' +
        'with x-api-key; people with a bearer token from /auth/login. Amounts are ' +
        'integers of minor units and come back as { amount: string, currency }.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, API_KEY_SCHEME)
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Serves interactive docs at /docs and the raw spec at /docs-json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app));
}
