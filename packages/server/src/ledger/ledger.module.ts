import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ServicesModule } from '../services/services.module.js';
import { EntryRepository } from './entry.repository.js';
import { LedgerTransactionRepository } from './ledger-transaction.repository.js';
import { ServiceTransactionsController } from './service-transactions.controller.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

@Module({
  imports: [IdentityModule, ServicesModule, AccountsModule, OrdersModule],
  controllers: [TransactionsController, ServiceTransactionsController],
  providers: [TransactionsService, LedgerTransactionRepository, EntryRepository],
  exports: [EntryRepository],
})
export class LedgerModule {}
