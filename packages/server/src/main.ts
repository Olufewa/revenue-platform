import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip fields the DTO doesn't declare
      forbidNonWhitelisted: true, // and reject it, so the caller finds out
      transform: true,            // '?page=2' arrives as a number, not text
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Log the port and nothing else. Never log DATABASE_URL - it has the password.
  console.log(`API listening on http://localhost:${port}`);
}

await bootstrap();
