import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-openidconnect';
import { AuthService, OidcProfile } from '../auth.service';
import { isOidcConfigured } from '../oidc.config';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    // Defensive: AuthModule only registers this provider when isOidcConfigured()
    // is true. If that ever regresses, fail with a clear message rather than
    // passport-openidconnect's opaque 'requires an issuer option' TypeError
    // (which throws synchronously from `new Strategy(...)` and crashes bootstrap).
    if (!isOidcConfigured()) {
      throw new Error(
        'OidcStrategy was instantiated without a complete OIDC_* configuration. ' +
          'It must only be registered when isOidcConfigured() returns true.',
      );
    }
    super({
      issuer: configService.get<string>('OIDC_ISSUER'),
      authorizationURL: configService.get<string>('OIDC_AUTH_URL'),
      tokenURL: configService.get<string>('OIDC_TOKEN_URL'),
      userInfoURL: configService.get<string>('OIDC_USERINFO_URL'),
      clientID: configService.get<string>('OIDC_CLIENT_ID'),
      clientSecret: configService.get<string>('OIDC_CLIENT_SECRET'),
      callbackURL: configService.get<string>('OIDC_CALLBACK_URL'),
      scope: ['openid', 'profile', 'email'],
    });
  }

  async validate(
    issuer: string,
    profile: OidcProfile,
    done: (error: unknown, user?: unknown) => void,
  ) {
    try {
      const user = await this.authService.validateOidcLogin(profile);
      done(null, user);
    } catch (error) {
      done(error);
    }
  }
}
