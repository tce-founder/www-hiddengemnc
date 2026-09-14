import { type INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide configuration shared by the Lambda entry (lambda.ts) and the local
 * dev server (main.ts), so the two cannot drift.
 *
 * There is deliberately no CORS configuration. The browser reaches the API
 * same-origin — through CloudFront's `/api/*` behavior when deployed and
 * through the Vite dev proxy locally — so no other origin is granted access.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
