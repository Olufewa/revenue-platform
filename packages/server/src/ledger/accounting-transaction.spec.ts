import { describe, expect, it } from 'vitest';
import { Currency } from '../money/currency.js';
import { ExchangeRate } from '../money/exchange-rate.js';
import { Money } from '../money/money.js';
import { buildTransaction, InvalidTransactionError, type Leg } from './accounting-transaction.js';

const NGN = Currency.of('NGN');
const USD = Currency.of('USD');

const leg = (
  accountCode: string,
  direction: 'DEBIT' | 'CREDIT',
  amount: number,
  currency: Currency = NGN,
): Leg => ({ accountCode, direction, amount: Money.of(amount, currency) });

// ₦3,500 bundle sale: cash in, VAT owed, revenue earned.
const bundleSale = [
  leg('cash', 'DEBIT', 350000),
  leg('vat_payable', 'CREDIT', 24419),
  leg('bundle_revenue', 'CREDIT', 325581),
];

const sumBase = (entries: { direction: string; baseAmount: Money }[], direction: string) =>
  entries
    .filter((e) => e.direction === direction)
    .reduce((sum, e) => sum + e.baseAmount.amountMinor, 0n);

describe('buildTransaction', () => {
  it('accepts a balanced base-currency transaction at rate 1', () => {
    const draft = buildTransaction({ currency: NGN, baseCurrency: NGN, legs: bundleSale });

    expect(draft.exchangeRate.isOne).toBe(true);
    expect(draft.entries.map((e) => e.baseAmount.amountMinor)).toEqual([
      350000n,
      24419n,
      325581n,
    ]);
  });

  it('rejects debits that do not equal credits', () => {
    const legs = [leg('cash', 'DEBIT', 350000), leg('bundle_revenue', 'CREDIT', 349999)];

    expect(() => buildTransaction({ currency: NGN, baseCurrency: NGN, legs })).toThrow(
      'Debits (350000 NGN) do not equal credits (349999 NGN)',
    );
  });

  it('requires at least two entries on both sides', () => {
    expect(() =>
      buildTransaction({ currency: NGN, baseCurrency: NGN, legs: [leg('cash', 'DEBIT', 1)] }),
    ).toThrow('at least two entries');

    expect(() =>
      buildTransaction({
        currency: NGN,
        baseCurrency: NGN,
        legs: [leg('cash', 'DEBIT', 1), leg('bank', 'DEBIT', 1)],
      }),
    ).toThrow('at least one DEBIT and one CREDIT');
  });

  it('rejects entries outside the transaction currency', () => {
    const legs = [leg('cash', 'DEBIT', 100, USD), leg('bundle_revenue', 'CREDIT', 100)];

    expect(() => buildTransaction({ currency: NGN, baseCurrency: NGN, legs })).toThrow(
      InvalidTransactionError,
    );
  });

  it('requires an exchange rate for a foreign currency', () => {
    const legs = [leg('cash', 'DEBIT', 1234, USD), leg('bundle_revenue', 'CREDIT', 1234, USD)];

    expect(() => buildTransaction({ currency: USD, baseCurrency: NGN, legs })).toThrow(
      'exchangeRate is required to convert USD to base currency NGN',
    );
  });

  it('rejects a non-1 rate for the base currency', () => {
    expect(() =>
      buildTransaction({
        currency: NGN,
        baseCurrency: NGN,
        exchangeRate: ExchangeRate.parse('2'),
        legs: bundleSale,
      }),
    ).toThrow('exchangeRate must be 1');
  });

  it('keeps the base side exactly balanced under an awkward rate', () => {
    // $10.00 split three ways at ₦1550.333: naive per-leg rounding would drift.
    const legs = [
      leg('cash', 'DEBIT', 1000, USD),
      leg('a_revenue', 'CREDIT', 333, USD),
      leg('b_revenue', 'CREDIT', 333, USD),
      leg('c_revenue', 'CREDIT', 334, USD),
    ];

    const draft = buildTransaction({
      currency: USD,
      baseCurrency: NGN,
      exchangeRate: ExchangeRate.parse('1550.333'),
      legs,
    });

    expect(sumBase(draft.entries, 'DEBIT')).toBe(1550333n);
    expect(sumBase(draft.entries, 'CREDIT')).toBe(1550333n);
    expect(draft.entries.every((e) => e.baseAmount.currency === NGN)).toBe(true);
  });
});
