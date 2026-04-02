import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @UseGuards(AuthGuard('oidc'))
  login() {
    return;
  }

  @Get('callback')
  @UseGuards(AuthGuard('oidc'))
  async callback(@Req() req: { user: User }) {
    return this.authService.issueJwt(req.user);
  }

  @Get('mock-login')
  async mockLogin() {
    // Stub MFU OIDC login for development/testing
    const mockProfile = {
      id: 'MFU12345678',
      displayName: 'Test Student',
      emails: [{ value: 'student@lamduan.mfu.ac.th' }],
      _json: { role: 'student' }
    };
    const user = await this.authService.validateOidcLogin(mockProfile);
    return this.authService.issueJwt(user);
  }
}
