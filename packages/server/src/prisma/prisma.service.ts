import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(config: ConfigService) {
    // Prisma 7 removed the query engine that used to ship inside the client.
    // The client now talks to Postgres through a driver adapter that you hand
    // it yourself - so this is where the connection string actually gets used.
    // Taking it from ConfigService (rather than process.env) guarantees .env is
    // loaded first, and getOrThrow makes the app refuse to start without it.
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
