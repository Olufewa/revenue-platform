import type { Leg } from '@/components/ui/TAccount';
import type { Status } from '@/components/ui/StatusBadge';
import { sumMoney, type Money } from './money';
import type { LedgerTransaction } from './types';

/**
 * How big a transaction is: the total of its debit legs. A balanced
 * transaction's debits equal its credits, so either side gives the same size.
 */
export function transactionAmount(transaction: LedgerTransaction): Money {
  const debits = transaction.entries
    .filter((entry) => entry.direction === 'DEBIT')
    .map((entry) => entry.amount);

  return (
    sumMoney(debits, transaction.currency) ?? {
      amount: '0',
      currency: transaction.currency,
    }
  );
}

/** Posted, reversed (cancelled by another), or a reversal (the one cancelling). */
export function transactionStatus(transaction: LedgerTransaction): Status {
  if (transaction.reversesTransactionId) return 'reversal';
  if (transaction.reversedByTransactionId) return 'reversed';
  return 'posted';
}

/** The entries split into the two sides of a T-account. */
export function toLegs(transaction: LedgerTransaction) {
  const legs = (direction: 'DEBIT' | 'CREDIT'): Leg[] =>
    transaction.entries
      .filter((entry) => entry.direction === direction)
      .map((entry) => ({
        account: entry.accountCode,
        amount: entry.amount.amount,
      }));

  return { debits: legs('DEBIT'), credits: legs('CREDIT') };
}
