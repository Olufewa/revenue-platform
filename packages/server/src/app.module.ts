import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ServicesModule } from './services/services.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IdentityModule,
    ServicesModule,
    AccountsModule,
    OrdersModule,
    LedgerModule,
    ReportsModule,
  ],
})
export class AppModule {}
