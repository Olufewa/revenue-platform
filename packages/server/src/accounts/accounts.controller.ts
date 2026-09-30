import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Controller('services/:serviceId/accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  create(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.accounts.create(serviceId, user.sub, dto);
  }

  @Patch(':code')
  update(
    @Param('serviceId') serviceId: string,
    @Param('code') code: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.accounts.update(serviceId, user.sub, code, dto);
  }

  @Get()
  list(@Param('serviceId') serviceId: string, @CurrentUser() user: { sub: string }) {
    return this.accounts.list(serviceId, user.sub);
  }
}
