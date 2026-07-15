import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createNewUser(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  exportMyData(@Req() req: { user: { id: string } }) {
    return this.usersService.exportUserData(req.user.id);
  }

  @Delete('me/account')
  @UseGuards(JwtAuthGuard)
  deleteMyAccount(@Req() req: { user: { id: string } }) {
    return this.usersService.deleteMyAccount(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.Admin)
  @UseGuards(RolesGuard)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
