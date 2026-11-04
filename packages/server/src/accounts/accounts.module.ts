import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesModule } from '../services/services.module.js';
import { AccountRepository } from './account.repository.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({
  imports: [IdentityModule, ServicesModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountRepository],
  exports: [AccountRepository],
})
export class AccountsModule {}
