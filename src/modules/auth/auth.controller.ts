import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('seed')
  async seed() {
    const adminEmail = 'admin@erp.com';
    const existingUser = await this.usersService.findByEmail(adminEmail);

    if (existingUser) {
      return { message: 'El usuario ya existe' };
    }

    const hashedPassword = await bcrypt.hash('123456', 10);
    const user = await this.usersService.create({
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isProfileCompleted: true,
    });

    return {
      message: 'Usuario Super Admin creado con éxito',
      user: {
        email: user.email,
        role: user.role,
      },
    };
  }
}
