import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  isStrongSecret,
  MIN_SECRET_LENGTH,
} from '../../config/security-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    // Fail fast instead of signing/verifying tokens with a weak or placeholder
    // secret. Enforced in EVERY environment, not just production.
    if (!isStrongSecret(secret)) {
      throw new Error(
        `JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} random characters ` +
          'and must not contain a placeholder word (change/secret-key/dev/example). ' +
          'See backend/.env.example.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: { sub: string; role: string; mfuId: string }) {
    return { id: payload.sub, role: payload.role, mfuId: payload.mfuId };
  }
}
