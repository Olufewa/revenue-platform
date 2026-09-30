import { Injectable } from '@nestjs/common';
import type { DbClient } from './db-client.js';
import { PrismaService } from './prisma.service.js';

/**
 * Runs a unit of work in one database transaction. Repositories join it
 * via `repository.withTx(tx)`.
 */
@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
