import { Controller, Get, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('mock-login')
  async mockLogin() {
    // Dev-only stub for MFU OIDC login. It mints a fully valid 7-day session JWT
    // for a fake student WITH NO CREDENTIALS, so it must never be reachable in a
    // deployed environment. Requires an explicit opt-in AND a non-production NODE_ENV.
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.ENABLE_MOCK_LOGIN !== 'true'
    ) {
      throw new NotFoundException();
    }

    const mockProfile = {
      id: 'MFU12345678',
      displayName: 'Test Student',
      emails: [{ value: 'student@lamduan.mfu.ac.th' }],
      _json: { role: 'student' },
    };
    const user = await this.authService.validateOidcLogin(mockProfile);
    return this.authService.issueJwt(user);
  }
}
