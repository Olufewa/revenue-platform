import { describe, expect, it } from 'vitest';
import { allocate, type PostingLine } from './allocation.js';

describe('allocate', () => {
  it('allocates the ₦3,500 bundle according to the blueprint', () => {
    const lines: PostingLine[] = [
      { accountCode: 'cash', direction: 'DEBIT', numerator: 1, denominator: 1 },
      { accountCode: 'vat_payable', direction: 'CREDIT', numerator: 75, denominator: 1075 },
      { accountCode: 'deferred_revenue', direction: 'CREDIT', numerator: 1000, denominator: 1075 },
    ];

    const result = allocate(350000n, lines);

    expect(result).toEqual([
      { accountCode: 'cash', direction: 'DEBIT', amountMinor: 350000n },
      { accountCode: 'vat_payable', direction: 'CREDIT', amountMinor: 24419n },
      { accountCode: 'deferred_revenue', direction: 'CREDIT', amountMinor: 325581n },
    ]);

    const debits = result
      .filter((r) => r.direction === 'DEBIT')
      .reduce((sum, r) => sum + r.amountMinor, 0n);
    const credits = result
      .filter((r) => r.direction === 'CREDIT')
      .reduce((sum, r) => sum + r.amountMinor, 0n);

    expect(debits).toBe(credits);
    expect(debits).toBe(350000n);
  });

  it('allocates a 50/50 split with no remainder', () => {
    const lines: PostingLine[] = [
      { accountCode: 'cash', direction: 'DEBIT', numerator: 1, denominator: 1 },
      { accountCode: 'earned_revenue', direction: 'CREDIT', numerator: 1, denominator: 2 },
      { accountCode: 'deferred_revenue', direction: 'CREDIT', numerator: 1, denominator: 2 },
    ];

    const result = allocate(1000n, lines);

    expect(result).toEqual([
      { accountCode: 'cash', direction: 'DEBIT', amountMinor: 1000n },
      { accountCode: 'earned_revenue', direction: 'CREDIT', amountMinor: 500n },
      { accountCode: 'deferred_revenue', direction: 'CREDIT', amountMinor: 500n },
    ]);
  });

  it('absorbs remainder on the last line when splitting an odd amount', () => {
    const lines: PostingLine[] = [
      { accountCode: 'cash', direction: 'DEBIT', numerator: 1, denominator: 1 },
      { accountCode: 'earned_revenue', direction: 'CREDIT', numerator: 1, denominator: 3 },
      { accountCode: 'deferred_revenue', direction: 'CREDIT', numerator: 2, denominator: 3 },
    ];

    const result = allocate(1000n, lines);

    expect(result).toEqual([
      { accountCode: 'cash', direction: 'DEBIT', amountMinor: 1000n },
      { accountCode: 'earned_revenue', direction: 'CREDIT', amountMinor: 333n },
      { accountCode: 'deferred_revenue', direction: 'CREDIT', amountMinor: 667n },
    ]);
  });

  it('throws when there is no debit line', () => {
    const lines: PostingLine[] = [
      { accountCode: 'cash', direction: 'CREDIT', numerator: 1, denominator: 1 },
    ];

    expect(() => allocate(1000n, lines)).toThrow();
  });

  it('throws when there is no credit line', () => {
    const lines: PostingLine[] = [
      { accountCode: 'cash', direction: 'DEBIT', numerator: 1, denominator: 1 },
    ];

    expect(() => allocate(1000n, lines)).toThrow();
  });
});
