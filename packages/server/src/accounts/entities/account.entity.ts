import type { Account, AccountType } from '../../generated/prisma/client.js';

const DEBIT_NORMAL: ReadonlySet<AccountType> = new Set(['ASSET', 'EXPENSE']);

/** Fowler's Account: a named bucket in one service's chart of accounts. */
export class AccountEntity {
  private constructor(
    readonly id: string,
    readonly serviceId: string,
    readonly code: string,
    readonly name: string,
    readonly type: AccountType,
    readonly createdAt: Date,
    readonly archivedAt: Date | null,
  ) {}

  static fromRecord(row: Account): AccountEntity {
    return new AccountEntity(
      row.id,
      row.serviceId,
      row.code,
      row.name,
      row.type,
      row.createdAt,
      row.archivedAt,
    );
  }

  /**
   * Signed balance on the account's normal side: assets and expenses grow
   * with debits; liabilities, equity and income grow with credits.
   */
  static normalBalance(type: AccountType, debitMinor: bigint, creditMinor: bigint): bigint {
    return DEBIT_NORMAL.has(type) ? debitMinor - creditMinor : creditMinor - debitMinor;
  }

  get isArchived(): boolean {
    return this.archivedAt !== null;
  }

  normalBalance(debitMinor: bigint, creditMinor: bigint): bigint {
    return AccountEntity.normalBalance(this.type, debitMinor, creditMinor);
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      type: this.type,
      archived: this.isArchived,
      archivedAt: this.archivedAt,
      createdAt: this.createdAt,
    };
  }
}
