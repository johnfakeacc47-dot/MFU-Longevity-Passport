import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const authService = app.get(AuthService);

  try {
    // Create an admin user
    const adminUser = await usersService.findByMfuId('admin-001');
    
    let user;
    if (!adminUser) {
      console.log('Creating admin user...');
      user = await usersService.create({
        mfuId: 'admin-001',
        email: 'admin@mfu.ac.th',
        name: 'Admin User',
        role: UserRole.Admin,
        faculty: 'Administration',
        department: 'IT',
      });
      console.log('✅ Admin user created:', user.email);
    } else {
      user = adminUser;
      console.log('✅ Admin user already exists:', user.email);
    }

    // Generate JWT token
    const { accessToken } = await authService.issueJwt(user);
    
    console.log('\n🔑 JWT Token for admin:');
    console.log('─'.repeat(80));
    console.log(accessToken);
    console.log('─'.repeat(80));
    console.log('\n📝 To use this token for admin login:');
    console.log('Update Login.tsx with this token for admin user');
    console.log('\n✅ Token expires in 7 days');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
