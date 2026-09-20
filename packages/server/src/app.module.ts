import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { ServicesModule } from './services/services.module.js';
import { EventsModule } from './events/events.module.js';
import { LedgerModule } from './ledger/ledger.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IdentityModule,
    ServicesModule,
    EventsModule,
    LedgerModule,
  ],
})
export class AppModule {}
