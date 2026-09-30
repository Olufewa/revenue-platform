import type { Entry, LedgerTransaction } from '../../generated/prisma/client.js';
import { Currency } from '../../money/currency.js';
import { ExchangeRate } from '../../money/exchange-rate.js';
import type { DraftEntry } from '../accounting-transaction.js';
import { EntryEntity } from './entry.entity.js';

export type LedgerTransactionRecord = LedgerTransaction & {
  entries: Array<Entry & { account: { code: string; name: string } }>;
  service: { baseCurrency: string };
  reversedBy: { id: string } | null;
};

/** A posted, immutable accounting transaction recorded against an order. */
export class LedgerTransactionEntity {
  private constructor(
    readonly id: string,
    readonly serviceId: string,
    readonly orderId: string | null,
    readonly externalId: string,
    readonly description: string | null,
    readonly currency: Currency,
    readonly exchangeRate: ExchangeRate,
    readonly requestHash: string | null,
    readonly occurredAt: Date,
    readonly createdAt: Date,
    readonly reversesTransactionId: string | null,
    readonly reversedByTransactionId: string | null,
    readonly entries: EntryEntity[],
  ) {}

  static fromRecord(row: LedgerTransactionRecord): LedgerTransactionEntity {
    const currency = Currency.of(row.currency);
    const baseCurrency = Currency.of(row.service.baseCurrency);

    return new LedgerTransactionEntity(
      row.id,
      row.serviceId,
      row.orderId,
      row.externalId,
      row.description,
      currency,
      ExchangeRate.parse(row.exchangeRate),
      row.requestHash,
      row.occurredAt,
      row.createdAt,
      row.reversesTransactionId,
      row.reversedBy?.id ?? null,
      row.entries.map((e) => EntryEntity.fromRecord(e, currency, baseCurrency)),
    );
  }

  get isReversal(): boolean {
    return this.reversesTransactionId !== null;
  }

  get isReversed(): boolean {
    return this.reversedByTransactionId !== null;
  }

  /** The mirror-image entries that cancel this transaction out. */
  reversalEntries(): Array<DraftEntry & { accountId: string }> {
    return this.entries.map((entry) => ({
      accountId: entry.accountId,
      accountCode: entry.account.code,
      direction: entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      amount: entry.amount,
      baseAmount: entry.baseAmount,
    }));
  }

  toJSON() {
    return {
      id: this.id,
      orderId: this.orderId,
      externalId: this.externalId,
      description: this.description,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      occurredAt: this.occurredAt,
      createdAt: this.createdAt,
      reversesTransactionId: this.reversesTransactionId,
      reversedByTransactionId: this.reversedByTransactionId,
      entries: this.entries,
    };
  }
}
