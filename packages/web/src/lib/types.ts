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
  /** Anything extra the product team sent, such as the sales channel. */
  metadata: Record<string, unknown> | null;
  placedAt: string;
  createdAt: string;
}

/** One leg of a ledger transaction. */
export interface Entry {
  id: string;
  accountCode: string;
  accountName: string;
  direction: 'DEBIT' | 'CREDIT';
  /** In the transaction's currency. */
  amount: Money;
  /** Converted to the service's base currency. */
  baseAmount: Money;
}

/** A balanced set of entries, as the transactions endpoints return it. */
export interface LedgerTransaction {
  id: string;
  orderId: string | null;
  externalId: string;
  description: string | null;
  currency: string;
  /** Rate to the base currency, as text such as "1550.25". Null when not needed. */
  exchangeRate: string | null;
  rateSource: string | null;
  occurredAt: string;
  createdAt: string;
  reversesTransactionId: string | null;
  reversedByTransactionId: string | null;
  entries: Entry[];
}

/** `GET /services/:id/orders/:orderId/summary`: how much of an order is booked as income. */
export interface OrderSummary {
  order: Order;
  transactionCount: number;
  reversedCount: number;
  income: { base: Money; byCurrency: Money[] };
  /** The order total minus the income recognised in the order's currency. */
  outstanding: Money;
  fullyRecognised: boolean;
}

/** One page of a list. Pass `nextCursor` back as `?cursor=` for the next page. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** An account in a service's chart of accounts. */
export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  /** Archived accounts take no new entries. Reversals still work. */
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

/** One account's line on a statement, on its normal side, in base currency. */
export interface StatementLine {
  accountCode: string;
  accountName: string;
  amount: Money;
}

/** A group of statement lines and their total, such as "Income". */
export interface StatementSection {
  lines: StatementLine[];
  total: Money;
}

/** `GET /services/:id/reports/income-statement`: income less expenses for a period. */
export interface IncomeStatement {
  baseCurrency: string;
  period: { from: string; to: string };
  income: StatementSection;
  expenses: StatementSection;
  netIncome: Money;
}

/** `GET /services/:id/reports/balance-sheet`: what the service holds and owes at a moment. */
export interface BalanceSheet {
  baseCurrency: string;
  asOf: string;
  assets: StatementSection;
  liabilities: StatementSection;
  /** Includes a worked-out `retained_earnings` line. */
  equity: StatementSection;
  totalLiabilitiesAndEquity: Money;
  balanced: boolean;
}

/** `GET /services/:id/reports/cash-flow`: how cash moved over a period (indirect method). */
export interface CashFlow {
  baseCurrency: string;
  period: { from: string; to: string };
  cashAccounts: string[];
  operating: { netIncome: Money; adjustments: StatementLine[]; total: Money };
  financing: StatementSection;
  netChangeInCash: Money;
  cashReceived: Money;
  cashPaidOut: Money;
  openingCash: Money;
  closingCash: Money;
  /** Opening cash plus the change equals closing cash. */
  reconciles: boolean;
}
