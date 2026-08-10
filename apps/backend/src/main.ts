// ─── MUST be the FIRST import: OpenTelemetry SDK initialization ─
// This applies auto-instrumentation hooks before any NestJS code runs.
import './tracing';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { setupSwagger } from './config/swagger.config';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Requested-With'],
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get('APP_PORT', 4000);

  // ─── Security Middleware ──────────────────────────────────────
  app.use(helmet());

  // ─── Correlation ID ──────────────────────────────────────────
  app.use(new CorrelationIdMiddleware().use);

  // ─── Global Pipes ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── Global Filters ──────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global Interceptors ─────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // ─── Graceful Shutdown ───────────────────────────────────────
  app.enableShutdownHooks();

  // ─── Swagger / OpenAPI ────────────────────────────────────────
  setupSwagger(app);

  await app.listen(port);
  logger.log(`Jeevandata API server running on http://localhost:${port}`);
  logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch((err) => {
  // Use console.error (NOT the buffered Nest logger): bufferLogs: true means
  // the Nest logger only flushes after app.listen() succeeds — if bootstrap
  // throws, buffered output is lost and the real error is invisible (the smoke
  // test saw exactly this: only direct console.warn lines appeared).
  console.error('Failed to start server:', err);
  process.exit(1);
});
