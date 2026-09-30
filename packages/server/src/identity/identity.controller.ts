import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IdentityService } from './identity.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.identity.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }
}
