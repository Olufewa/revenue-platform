import { describe, expect, it } from 'vitest';
import { formatCompact, formatMoney, sumMoney } from './money';

const ngn = (amount: string) => ({ amount, currency: 'NGN' });

describe('formatMoney', () => {
  it('formats minor units with the currency symbol', () => {
    expect(formatMoney(ngn('350000'))).toBe('₦3,500.00');
  });

  it('can leave the symbol to the column header', () => {
    expect(formatMoney(ngn('107500'), { symbol: false })).toBe('1,075.00');
  });

  it('pads amounts smaller than one major unit', () => {
    expect(formatMoney(ngn('5'))).toBe('₦0.05');
    expect(formatMoney(ngn('0'))).toBe('₦0.00');
  });

  it('keeps the sign on negative amounts', () => {
    expect(formatMoney(ngn('-350000'))).toBe('-₦3,500.00');
    expect(formatMoney(ngn('-5'), { symbol: false })).toBe('-0.05');
  });

  it('uses the fraction digits of the currency', () => {
    expect(formatMoney({ amount: '5000', currency: 'JPY' })).toBe('¥5,000');
    expect(
      formatMoney({ amount: '5000', currency: 'JPY' }, { symbol: false }),
    ).toBe('5,000');
    expect(formatMoney({ amount: '5000', currency: 'USD' })).toBe('$50.00');
  });

  it('does not lose precision above 2^53', () => {
    expect(formatMoney(ngn('123456789012345678901'))).toBe(
      '₦1,234,567,890,123,456,789.01',
    );
  });
});

describe('formatCompact', () => {
  it('rounds to three significant figures', () => {
    expect(formatCompact(ngn('4821793050'))).toBe('₦48.2M');
    expect(formatCompact(ngn('288000000'))).toBe('₦2.88M');
  });

  it('keeps small and negative amounts readable', () => {
    expect(formatCompact(ngn('0'))).toBe('₦0');
    expect(formatCompact(ngn('-4821793050'))).toBe('-₦48.2M');
  });
});

describe('sumMoney', () => {
  it('adds amounts exactly, beyond what a JavaScript number holds', () => {
    expect(sumMoney([ngn('9007199254740993'), ngn('7')], 'NGN')).toEqual(
      ngn('9007199254741000'),
    );
    expect(sumMoney([], 'NGN')).toEqual(ngn('0'));
  });

  it('refuses to add different currencies', () => {
    expect(
      sumMoney([ngn('100'), { amount: '100', currency: 'USD' }], 'NGN'),
    ).toBeNull();
  });
});
