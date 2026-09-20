import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { LedgerService } from './ledger.service.js';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  list() {
    return this.ledger.listAccounts();
  }
}
