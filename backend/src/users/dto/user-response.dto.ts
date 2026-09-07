import { User, UserRole } from '../../entities/user.entity';

export class UserResponseDto {
  id: string;
  mfuId: string;
  email: string;
  name?: string;
  role: UserRole;
  faculty?: string;
  department?: string;
  consentGiven: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.mfuId = user.mfuId;
    dto.email = user.email;
    dto.name = user.name;
    dto.role = user.role;
    dto.faculty = user.faculty;
    dto.department = user.department;
    dto.consentGiven = user.consentGiven;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
