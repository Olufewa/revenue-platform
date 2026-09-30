import { Inject, Injectable } from '@nestjs/common';
import type { EntryDirection } from '../generated/prisma/client.js';
import type { Currency } from '../money/currency.js';
import type { ExchangeRate } from '../money/exchange-rate.js';
import type { Money } from '../money/money.js';
import type { DbClient } from '../prisma/db-client.js';
import type { Page } from '../prisma/page.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LedgerTransactionEntity } from './entities/ledger-transaction.entity.js';

const INCLUDE = {
  entries: {
    include: { account: { select: { code: true, name: true } } },
    orderBy: [{ direction: 'asc' as const }, { id: 'asc' as const }],
  },
  service: { select: { baseCurrency: true } },
  reversedBy: { select: { id: true } },
};

export type NewLedgerTransaction = {
  serviceId: string;
  orderId: string | null;
  externalId: string;
  description?: string;
  currency: Currency;
  exchangeRate: ExchangeRate;
  requestHash: string;
  occurredAt: Date;
  reversesTransactionId?: string;
  entries: Array<{
    accountId: string;
    direction: EntryDirection;
    amount: Money;
    baseAmount: Money;
  }>;
};

@Injectable()
export class LedgerTransactionRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): LedgerTransactionRepository {
    return new LedgerTransactionRepository(tx);
  }

  async findByExternalId(
    serviceId: string,
    externalId: string,
  ): Promise<LedgerTransactionEntity | null> {
    const row = await this.db.ledgerTransaction.findUnique({
      where: { serviceId_externalId: { serviceId, externalId } },
      include: INCLUDE,
    });
    return row && LedgerTransactionEntity.fromRecord(row);
  }

  async findInService(serviceId: string, id: string): Promise<LedgerTransactionEntity | null> {
    const row = await this.db.ledgerTransaction.findFirst({
      where: { id, serviceId },
      include: INCLUDE,
    });
    return row && LedgerTransactionEntity.fromRecord(row);
  }

  /** Newest first, cursor-paged by id. */
  async listPage(
    serviceId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<Page<LedgerTransactionEntity>> {
    const rows = await this.db.ledgerTransaction.findMany({
      where: { serviceId },
      include: INCLUDE,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, opts.limit);

    return {
      items: page.map((row) => LedgerTransactionEntity.fromRecord(row)),
      nextCursor: rows.length > opts.limit ? page[page.length - 1].id : null,
    };
  }

  async listForOrder(serviceId: string, orderId: string): Promise<LedgerTransactionEntity[]> {
    const rows = await this.db.ledgerTransaction.findMany({
      where: { serviceId, orderId },
      include: INCLUDE,
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => LedgerTransactionEntity.fromRecord(row));
  }

  /** Writes the transaction and all of its entries in one statement. */
  async create(txn: NewLedgerTransaction): Promise<LedgerTransactionEntity> {
    const row = await this.db.ledgerTransaction.create({
      data: {
        serviceId: txn.serviceId,
        orderId: txn.orderId,
        externalId: txn.externalId,
        description: txn.description,
        currency: txn.currency.code,
        exchangeRate: txn.exchangeRate.toString(),
        requestHash: txn.requestHash,
        occurredAt: txn.occurredAt,
        reversesTransactionId: txn.reversesTransactionId,
        entries: {
          create: txn.entries.map((entry) => ({
            serviceId: txn.serviceId,
            accountId: entry.accountId,
            direction: entry.direction,
            amountMinor: entry.amount.amountMinor,
            baseAmountMinor: entry.baseAmount.amountMinor,
            occurredAt: txn.occurredAt,
          })),
        },
      },
      include: INCLUDE,
    });
    return LedgerTransactionEntity.fromRecord(row);
  }
}
