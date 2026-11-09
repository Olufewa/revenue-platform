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
