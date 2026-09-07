import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  mfuId: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  faculty?: string;

  @IsOptional()
  @IsString()
  department?: string;
}
