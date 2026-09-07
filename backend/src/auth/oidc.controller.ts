import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

/**
 * MFU SSO (OpenID Connect) login routes. AuthModule registers this controller
 * ONLY when isOidcConfigured() is true (see backend/src/auth/oidc.config.ts and
 * auth.module.ts), so when OIDC env vars are absent these routes return 404
 * rather than 500-ing on a missing passport strategy.
 */
@Controller('auth')
export class OidcController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @UseGuards(AuthGuard('oidc'))
  login() {
    return;
  }

  @Get('callback')
  @UseGuards(AuthGuard('oidc'))
  async callback(@Req() req: { user: any }) {
    return this.authService.issueJwt(req.user);
  }
}
