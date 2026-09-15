import 'reflect-metadata';
import serverlessExpress from '@codegenie/serverless-express';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * AWS Lambda entry point (API Gateway REST proxy integration).
 *
 * The Nest app is created once per container and reused across invocations.
 * infra/lib/backend-stack.ts bundles the tsc output of this file
 * (dist/lambda.js), never the TypeScript source — see the note in tsconfig.json.
 */
type ProxyHandler = ReturnType<typeof serverlessExpress>;

let cachedHandler: Promise<ProxyHandler> | undefined;

async function bootstrap(): Promise<ProxyHandler> {
  const expressApp = express();
  expressApp.disable('x-powered-by');

  // The serverless adapter hands Express the request body as a raw Buffer.
  // body-parser treats an already-present body as parsed and skips it, so the
  // Buffer would reach the controller untouched and every DTO would fail
  // validation one character at a time ("property 0 should not exist").
  // Decode it here, then let the normal parsers handle anything else.
  expressApp.use((req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf8');
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        // Not JSON — ValidationPipe rejects the empty object with a 400.
        req.body = {};
      }
    }
    next();
  });
  expressApp.use(express.json({ limit: '100kb' }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });
  configureApp(app);
  await app.init();

  return serverlessExpress({ app: expressApp });
}

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // A failed bootstrap is not cached, so the next invocation retries it.
    cachedHandler ??= bootstrap().catch((error: unknown) => {
      cachedHandler = undefined;
      throw error;
    });
    const proxy = await cachedHandler;
    return (await proxy(event, context, () => undefined)) as APIGatewayProxyResult;
  } catch (error) {
    // Details stay in CloudWatch; the caller only learns that it failed.
    new Logger('Lambda').error('Unhandled error', error instanceof Error ? error.stack : error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
    };
  }
}
