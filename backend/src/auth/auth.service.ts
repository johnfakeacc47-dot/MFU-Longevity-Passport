import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../entities/user.entity';

export interface OidcProfile {
  id?: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  _json?: Record<string, unknown>;
  provider?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateOidcLogin(profile: OidcProfile): Promise<User> {
    const mfuId = profile.id || profile._json?.preferred_username || '';
    const email = profile.emails?.[0]?.value || profile._json?.email || '';
    const name = profile.displayName || profile._json?.name;
    const role = (profile._json?.role as UserRole) || UserRole.Student;
    const faculty = profile._json?.faculty;
    const department = profile._json?.department;

    const existing = await this.usersService.findByMfuId(mfuId);
    if (existing) {
      return this.usersService.update(existing, {
        mfuId,
        email,
        name,
        role,
        faculty,
        department,
      });
    }

    return this.usersService.create({
      mfuId,
      email,
      name,
      role,
      faculty,
      department,
    });
  }

  async issueJwt(user: User) {
    const payload = { sub: user.id, role: user.role, mfuId: user.mfuId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        mfuId: user.mfuId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
