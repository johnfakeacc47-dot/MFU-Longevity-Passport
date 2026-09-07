import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateSelfDto } from '../dto/update-self.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { UserRole } from '../../entities/user.entity';

interface AuthUser {
  id: string;
  role: UserRole;
  mfuId: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.Admin)
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createNewUser(dto);
  }

  @Get()
  @Roles(UserRole.Admin)
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('me/export')
  exportMyData(@CurrentUser() user: AuthUser) {
    return this.usersService.exportUserData(user.id);
  }

  @Delete('me/account')
  deleteMyAccount(@CurrentUser() user: AuthUser) {
    return this.usersService.deleteMyAccount(user.id);
  }

  @Patch('me')
  updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateSelfDto) {
    return this.usersService.updateSelf(user.id, dto);
  }

  @Get(':id')
  getUserById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (user.id !== id && user.role !== UserRole.Admin) {
      throw new ForbiddenException('You may only view your own user record');
    }
    return this.usersService.getUserById(id);
  }

  @Put(':id')
  @Roles(UserRole.Admin)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
