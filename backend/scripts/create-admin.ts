import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/entities/user.entity';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'dev_password',
  database: 'longevity_db',
  entities: [User],
  synchronize: false,
});

async function createAdmin() {
  await AppDataSource.initialize();
  console.log('✅ Connected to database');

  const userRepository = AppDataSource.getRepository(User);

  // Check if admin already exists
  const existingAdmin = await userRepository.findOne({
    where: { email: 'admin@mfu.ac.th' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists: admin@mfu.ac.th');
    
    // Generate JWT token
    const payload = {
      sub: existingAdmin.id,
      role: existingAdmin.role,
      mfuId: existingAdmin.mfuId,
    };
    const token = jwt.sign(payload, 'development-secret-key-change-in-production', { expiresIn: '7d' });
    
    console.log('\n🔑 JWT Token for admin:');
    console.log(token);
    console.log('\n📝 To use this token:');
    console.log('1. In browser console: localStorage.setItem("authToken", "' + token + '")');
    console.log('2. In API requests: Authorization: Bearer ' + token);
    console.log(`\n✅ Token expires in 7 days`);
    
    await AppDataSource.destroy();
    return;
  }

  // Create admin user
  const admin = userRepository.create();
  admin.email = 'admin@mfu.ac.th';
  admin.mfuId = 'admin-001';
  admin.name = 'Admin User';
  admin.role = UserRole.Admin;
  admin.faculty = 'Administration';
  admin.department = 'IT';

  await userRepository.save(admin);
  console.log('✅ Admin user created: admin@mfu.ac.th');

  // Generate JWT token
  const payload = {
    sub: admin.id,
    role: admin.role,
    mfuId: admin.mfuId,
  };
  const token = jwt.sign(payload, 'development-secret-key-change-in-production', { expiresIn: '7d' });
  
  console.log('\n🔑 JWT Token for admin:');
  console.log(token);
  console.log('\n📝 To use this token:');
  console.log('1. In browser console: localStorage.setItem("authToken", "' + token + '")');
  console.log('2. In API requests: Authorization: Bearer ' + token);
  console.log(`\n✅ Token expires in 7 days`);

  await AppDataSource.destroy();
}

createAdmin().catch((error) => {
  console.error('❌ Error creating admin:', error);
  process.exit(1);
});
