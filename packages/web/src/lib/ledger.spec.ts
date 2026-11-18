import { describe, expect, it } from 'vitest';
import { toLegs, transactionAmount, transactionStatus } from './ledger';
import type { Entry, LedgerTransaction } from './types';

const ngn = (amount: string) => ({ amount, currency: 'NGN' });

const entry = (
  accountCode: string,
  direction: Entry['direction'],
  amount: string,
): Entry => ({
  id: accountCode,
  accountCode,
  accountName: accountCode,
  direction,
  amount: ngn(amount),
  baseAmount: ngn(amount),
});

// A ₦1,075.00 bundle sale: ₦75.00 VAT and ₦1,000.00 revenue.
const sale: LedgerTransaction = {
  id: 'txn_1',
  orderId: 'ord_1',
  externalId: 'bundle-1-sale',
  description: null,
  currency: 'NGN',
  exchangeRate: null,
  rateSource: null,
  occurredAt: '2026-11-17T09:00:00.000Z',
  createdAt: '2026-11-17T09:00:00.000Z',
  reversesTransactionId: null,
  reversedByTransactionId: null,
  entries: [
    entry('cash', 'DEBIT', '107500'),
    entry('vat_payable', 'CREDIT', '7500'),
    entry('bundle_revenue', 'CREDIT', '100000'),
  ],
};

describe('ledger helpers', () => {
  it('sizes a transaction by its debits', () => {
    expect(transactionAmount(sale)).toEqual(ngn('107500'));
  });

  it('splits the entries into debits and credits', () => {
    expect(toLegs(sale)).toEqual({
      debits: [{ account: 'cash', amount: '107500' }],
      credits: [
        { account: 'vat_payable', amount: '7500' },
        { account: 'bundle_revenue', amount: '100000' },
      ],
    });
  });

  it('tells posted, reversed and reversal apart', () => {
    expect(transactionStatus(sale)).toBe('posted');
    expect(
      transactionStatus({ ...sale, reversedByTransactionId: 'txn_2' }),
    ).toBe('reversed');
    expect(transactionStatus({ ...sale, reversesTransactionId: 'txn_0' })).toBe(
      'reversal',
    );
  });
});
