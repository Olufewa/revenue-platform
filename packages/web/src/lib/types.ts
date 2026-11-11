import type { Money } from './money';

/** A service, as `GET /services` and `GET /services/:id` return it. */
export interface Service {
  id: string;
  slug: string;
  name: string;
  baseCurrency: string;
  timezone: string;
  createdAt: string;
}

/** An API key as listed. The full key is only returned when it is created. */
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  active: boolean;
}

export type AccountType =
  'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

/** `GET /services/:id/reports/revenue`: income per local day, and the total. */
export interface RevenueReport {
  baseCurrency: string;
  timezone: string;
  window: { from: string; to: string };
  series: { day: string; amount: Money }[];
  total: Money;
}

/** `GET /services/:id/balances`: every account's debits, credits and balance. */
export interface Balances {
  baseCurrency: string;
  asOf: string;
  accounts: {
    accountCode: string;
    accountName: string;
    type: AccountType;
    debit: Money;
    credit: Money;
    balance: Money;
  }[];
  totals: { debit: Money; credit: Money };
}

/** `POST /services/:id/keys`: the listed fields plus the full key, shown once. */
export interface CreatedApiKey extends ApiKey {
  key: string;
}

/** An order, as the orders endpoints return it. */
export interface Order {
  id: string;
  externalId: string;
  total: Money;
  description: string | null;
  customerRef: string | null;
  placedAt: string;
  createdAt: string;
}

/** One leg of a ledger transaction. */
export interface Entry {
  id: string;
  accountCode: string;
  accountName: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: Money;
}

/** A balanced set of entries, as the transactions endpoints return it. */
export interface LedgerTransaction {
  id: string;
  orderId: string | null;
  externalId: string;
  description: string | null;
  currency: string;
  occurredAt: string;
  reversesTransactionId: string | null;
  reversedByTransactionId: string | null;
  entries: Entry[];
}
