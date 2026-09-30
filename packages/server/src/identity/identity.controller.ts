import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IdentityService } from './identity.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    console.log(dto);
    return this.identity.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }
}
