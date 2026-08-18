import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Reject/strip malformed request bodies before they ever reach a service or
  // TypeORM — without this, class-validator decorators on DTOs do nothing.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared on the DTO
      forbidNonWhitelisted: true, // reject requests that include them, instead of silently dropping
      transform: true, // convert payloads (e.g. numeric strings) into the DTO's declared types
    }),
  );

  // Enable CORS for frontend. Falls back to localhost for local dev; set
  // CORS_ORIGIN (comma-separated for multiple) in production.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Backend server running on http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error('❌ Failed to start backend server:', err);
  process.exit(1);
});
