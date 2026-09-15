import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * Local development server (`pnpm dev:api`). Never deployed — AWS runs
 * lambda.ts.
 *
 * Defaults below make a fresh clone work with no setup: submissions are logged
 * rather than stored or emailed, reCAPTCHA is skipped, and the origin secret
 * matches the header the Vite dev proxy injects. Override any of them in
 * apps/api/.env (see .env.example).
 */
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file — use the defaults below and the shell environment.
}

process.env.API_ORIGIN_SECRET ??= 'local-dev-origin-secret';
process.env.CONTACT_DRY_RUN ??= 'true';
process.env.ALLOW_UNVERIFIED_SUBMISSIONS ??= 'true';
process.env.PUBLIC_SITE_URL ??= 'http://localhost:8080';

async function start(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

void start();
