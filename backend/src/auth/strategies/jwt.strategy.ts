import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    // Fail fast instead of silently signing/verifying tokens with a hardcoded
    // literal — that masks a misconfigured deploy rather than surfacing it.
    if (!secret) {
      throw new Error('JWT_SECRET must be set (see backend/.env.example).');
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
