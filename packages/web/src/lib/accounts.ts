import type { AccountType } from './types';

/** Every account type, in the order statements list them. */
export const ACCOUNT_TYPES: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
];

/** What each type means, for the "Add account" dropdown. */
export const TYPE_HINTS: Record<AccountType, string> = {
  ASSET: 'what the service holds',
  LIABILITY: 'what it owes',
  EQUITY: "the owners' share",
  INCOME: 'money earned',
  EXPENSE: 'money going out',
};

/** Section headings, plural. */
export const TYPE_HEADINGS: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};

/** The same rule the API checks: lowercase, digits, single underscores. */
export const CODE_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;
