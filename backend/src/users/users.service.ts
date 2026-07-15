import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async createNewUser(dto: CreateUserDto) {
    const user = this.usersRepository.create();
    user.email = dto.email;
    user.mfuId = dto.mfuId;
    user.name = dto.name;
    user.role = dto.role;
    user.faculty = dto.faculty;
    user.department = dto.department;
    return this.usersRepository.save(user);
  }

  async getAllUsers() {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getUserById(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async exportUserData(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['meals', 'activities', 'sleepLogs', 'fastingSessions'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.getUserById(id);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.faculty !== undefined) user.faculty = dto.faculty;
    if (dto.department !== undefined) user.department = dto.department;
    return this.usersRepository.save(user);
  }

  async deleteUser(id: string) {
    const user = await this.getUserById(id);
    return this.usersRepository.remove(user);
  }

  async deleteMyAccount(id: string) {
    // Under PDPA, users can request their own account deletion
    const user = await this.getUserById(id);
    // Hard delete or soft delete, we'll hard remove for PDPA full compliance
    return this.usersRepository.remove(user);
  }
}
