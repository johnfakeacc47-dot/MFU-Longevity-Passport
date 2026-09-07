import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { UserResponseDto } from './dto/user-response.dto';

export interface UpsertUserInput {
  mfuId: string;
  email: string;
  name?: string;
  role?: UserRole;
  faculty?: string;
  department?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByMfuId(mfuId: string) {
    return this.usersRepository.findOne({ where: { mfuId } });
  }

  async create(data: UpsertUserInput) {
    const user = this.usersRepository.create({
      ...data,
      role: data.role ?? UserRole.Student,
    });
    return this.usersRepository.save(user);
  }

  async update(existing: User, data: UpsertUserInput) {
    const updated = this.usersRepository.merge(existing, {
      ...data,
      role: data.role ?? existing.role,
    });
    return this.usersRepository.save(updated);
  }

  async createNewUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = this.usersRepository.create();
    user.email = dto.email;
    user.mfuId = dto.mfuId;
    user.name = dto.name;
    user.role = dto.role;
    user.faculty = dto.faculty;
    user.department = dto.department;
    const saved = await this.usersRepository.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async getAllUsers(): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map((user) => UserResponseDto.fromEntity(user));
  }

  async getUserById(id: string): Promise<UserResponseDto> {
    const user = await this.findEntityOrThrow(id);
    return UserResponseDto.fromEntity(user);
  }

  async exportUserData(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['meals', 'activities', 'sleepLogs', 'fastingSessions'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return {
      ...UserResponseDto.fromEntity(user),
      meals: user.meals,
      activities: user.activities,
      sleepLogs: user.sleepLogs,
      fastingSessions: user.fastingSessions,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.findEntityOrThrow(id);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.faculty !== undefined) user.faculty = dto.faculty;
    if (dto.department !== undefined) user.department = dto.department;
    const saved = await this.usersRepository.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async updateSelf(id: string, dto: UpdateSelfDto): Promise<UserResponseDto> {
    const user = await this.findEntityOrThrow(id);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    const saved = await this.usersRepository.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async deleteUser(id: string): Promise<{ success: true }> {
    const user = await this.findEntityOrThrow(id);
    await this.usersRepository.remove(user);
    return { success: true };
  }

  async deleteMyAccount(id: string): Promise<{ success: true }> {
    // Under PDPA, users can request their own account deletion
    const user = await this.findEntityOrThrow(id);
    await this.usersRepository.remove(user);
    return { success: true };
  }

  private async findEntityOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }
}
