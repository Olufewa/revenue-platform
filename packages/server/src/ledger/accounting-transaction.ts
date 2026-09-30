import type { EntryDirection } from '../generated/prisma/client.js';
import type { Currency } from '../money/currency.js';
import { ExchangeRate } from '../money/exchange-rate.js';
import { Money } from '../money/money.js';

export class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionError';
  }
}

export type Leg = {
  accountCode: string;
  direction: EntryDirection;
  amount: Money;
};

export type DraftEntry = Leg & { baseAmount: Money };

export type DraftTransaction = {
  currency: Currency;
  exchangeRate: ExchangeRate;
  entries: DraftEntry[];
};

/**
 * Fowler's AccountingTransaction: a set of entries that must balance.
 *
 * Legs are given in the transaction currency and must balance exactly in it.
 * Base-currency amounts are derived by converting the transaction total once
 * and allocating it across each side in proportion to the legs, so the base
 * side balances exactly too, with no rounding drift.
 */
export function buildTransaction(input: {
  currency: Currency;
  baseCurrency: Currency;
  exchangeRate?: ExchangeRate;
  legs: Leg[];
}): DraftTransaction {
  const { currency, baseCurrency, legs } = input;

  if (legs.length < 2) {
    throw new InvalidTransactionError('A transaction needs at least two entries');
  }

  if (legs.some((leg) => !leg.amount.currency.equals(currency))) {
    throw new InvalidTransactionError(
      `Every entry must be in the transaction currency ${currency.code}`,
    );
  }

  if (legs.some((leg) => !leg.amount.isPositive())) {
    throw new InvalidTransactionError('Entry amounts must be positive');
  }

  const debits = legs.filter((leg) => leg.direction === 'DEBIT');
  const credits = legs.filter((leg) => leg.direction === 'CREDIT');

  if (debits.length === 0 || credits.length === 0) {
    throw new InvalidTransactionError(
      'A transaction needs at least one DEBIT and one CREDIT entry',
    );
  }

  const debitTotal = Money.sum(debits.map((l) => l.amount), currency);
  const creditTotal = Money.sum(credits.map((l) => l.amount), currency);

  if (!debitTotal.equals(creditTotal)) {
    throw new InvalidTransactionError(
      `Debits (${debitTotal}) do not equal credits (${creditTotal})`,
    );
  }

  const exchangeRate = resolveRate(currency, baseCurrency, input.exchangeRate);
  const baseTotal = debitTotal.convert(baseCurrency, exchangeRate);

  const baseAmounts = new Map<Leg, Money>();
  for (const side of [debits, credits]) {
    const parts = baseTotal.allocate(side.map((l) => l.amount.amountMinor));
    side.forEach((leg, i) => baseAmounts.set(leg, parts[i]));
  }

  return {
    currency,
    exchangeRate,
    entries: legs.map((leg) => ({ ...leg, baseAmount: baseAmounts.get(leg)! })),
  };
}

function resolveRate(
  currency: Currency,
  baseCurrency: Currency,
  rate: ExchangeRate | undefined,
): ExchangeRate {
  if (currency.equals(baseCurrency)) {
    if (rate && !rate.isOne) {
      throw new InvalidTransactionError(
        `exchangeRate must be 1 (or omitted) for ${currency.code}, the base currency`,
      );
    }
    return ExchangeRate.ONE;
  }

  if (!rate) {
    throw new InvalidTransactionError(
      `exchangeRate is required to convert ${currency.code} to base currency ${baseCurrency.code}`,
    );
  }

  return rate;
}
