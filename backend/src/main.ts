import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security response headers (nosniff, frameguard, HSTS, removes x-powered-by, ...).
  // Registered before any route handling.
  app.use(helmet());

  // Reject/strip malformed request bodies before they ever reach a service or
  // TypeORM - without this, class-validator decorators on DTOs do nothing.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Explicit CORS allow-list - never reflect an arbitrary Origin. Falls back to
  // local dev origins only; production must set CORS_ORIGIN (enforced at startup
  // by assertProductionConfig in security-config.ts).
  const corsOrigin = (
    process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:5173', 'http://localhost:3000']
  )
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend server running on http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error('Failed to start backend server:', err);
  process.exit(1);
});
