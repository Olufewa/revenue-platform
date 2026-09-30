import type { Entry, EntryDirection } from '../../generated/prisma/client.js';
import type { Currency } from '../../money/currency.js';
import { Money } from '../../money/money.js';

type EntryAccount = { code: string; name: string };

/** One leg of a ledger transaction, in its own and the base currency. */
export class EntryEntity {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly account: EntryAccount,
    readonly direction: EntryDirection,
    readonly amount: Money,
    readonly baseAmount: Money,
    readonly occurredAt: Date,
  ) {}

  static fromRecord(
    row: Entry & { account: EntryAccount },
    currency: Currency,
    baseCurrency: Currency,
  ): EntryEntity {
    return new EntryEntity(
      row.id,
      row.accountId,
      row.account,
      row.direction,
      Money.of(row.amountMinor, currency),
      Money.of(row.baseAmountMinor, baseCurrency),
      row.occurredAt,
    );
  }

  toJSON() {
    return {
      id: this.id,
      accountCode: this.account.code,
      accountName: this.account.name,
      direction: this.direction,
      amount: this.amount,
      baseAmount: this.baseAmount,
    };
  }
}
