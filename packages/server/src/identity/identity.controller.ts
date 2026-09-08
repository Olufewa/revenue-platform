import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IdentityService } from './identity.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.identity.register(dto);
  }

  // 200, not Nest's default 201 - logging in doesn't create anything.
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: { sub: string }) {
    return this.identity.findById(user.sub);
  }
}
