import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdentityService } from './identity.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('Identity')
@Controller('auth')
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
