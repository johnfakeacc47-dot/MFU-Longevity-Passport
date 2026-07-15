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
    // Create a test user
    const testUser = await usersService.findByMfuId('test-student-001');
    
    let user;
    if (!testUser) {
      console.log('Creating test user...');
      user = await usersService.create({
        mfuId: 'test-student-001',
        email: 'test@mfu.ac.th',
        name: 'Test Student',
        role: UserRole.Student,
        faculty: 'School of Information Technology',
        department: 'Software Engineering',
      });
      console.log('✅ Test user created:', user.email);
    } else {
      user = testUser;
      console.log('✅ Test user already exists:', user.email);
    }

    // Generate JWT token
    const { accessToken } = await authService.issueJwt(user);
    
    console.log('\n🔑 JWT Token for testing:');
    console.log('─'.repeat(80));
    console.log(accessToken);
    console.log('─'.repeat(80));
    console.log('\n📝 To use this token:');
    console.log('1. In browser console: localStorage.setItem("authToken", "' + accessToken + '")');
    console.log('2. In API requests: Authorization: Bearer ' + accessToken);
    console.log('\n✅ Token expires in 7 days');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
