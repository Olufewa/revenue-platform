import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { ServicesModule } from '../services/services.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [IdentityModule, ServicesModule, AccountsModule, LedgerModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
