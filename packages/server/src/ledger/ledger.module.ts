import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesModule } from '../services/services.module.js';
import { AccountsController } from './accounts.controller.js';
import { LedgerController } from './ledger.controller.js';
import { LedgerService } from './ledger.service.js';

@Module({
  imports: [IdentityModule, ServicesModule],
  controllers: [AccountsController, LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
