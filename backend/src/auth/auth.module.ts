import { Logger, Module, Provider, Type } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { OidcController } from './oidc.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { isOidcConfigured } from './oidc.config';
import { isStrongSecret, MIN_SECRET_LENGTH } from '../config/security-config';

const oidcEnabled = isOidcConfigured();

if (!oidcEnabled) {
  new Logger('AuthModule').warn(
    'OIDC_* env vars are not fully set - /auth/login and /auth/callback are disabled. ' +
      'Use GET /auth/mock-login (dev only, requires ENABLE_MOCK_LOGIN=true) for local testing.',
  );
}

const providers: Provider[] = [AuthService, JwtStrategy];
const controllers: Type<any>[] = [AuthController];
if (oidcEnabled) {
  providers.push(OidcStrategy);
  controllers.push(OidcController);
}

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!isStrongSecret(secret)) {
          throw new Error(
            `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} random characters ` +
              'and must not contain a placeholder word (change/secret-key/dev/example).',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers,
  providers,
  exports: [AuthService],
})
export class AuthModule {}
