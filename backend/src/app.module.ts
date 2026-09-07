import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import * as entities from './entities';
import { assertProductionConfig } from './config/security-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Fail the whole bootstrap (main.ts bootstrap().catch -> process.exit(1))
      // when a production deploy is misconfigured, instead of booting insecurely.
      // `config` here is @nestjs/config's merged view ({...(.env file), ...process.env}),
      // so this works even before dotenv writes to process.env.
      validate: (config: Record<string, any>) => {
        assertProductionConfig(config as Record<string, string | undefined>);
        return config;
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: Object.values(entities).filter(
          (e) => typeof e === 'function',
        ),
        synchronize:
          configService.get('DB_SYNCHRONIZE') === 'true' &&
          process.env.NODE_ENV !== 'production',
        // Postgres (e.g. the docker-compose container) can still be finishing startup
        // when this process boots — retry instead of crashing the whole server on the
        // first connection attempt.
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
