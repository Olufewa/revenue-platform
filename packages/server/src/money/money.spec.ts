import { describe, expect, it } from 'vitest';
import { Currency } from './currency.js';
import { ExchangeRate } from './exchange-rate.js';
import { Money } from './money.js';

const NGN = Currency.of('NGN');
const USD = Currency.of('USD');
const JPY = Currency.of('JPY');

describe('Currency', () => {
  it('knows minor units from ISO 4217', () => {
    expect(NGN.fractionDigits).toBe(2);
    expect(JPY.fractionDigits).toBe(0);
    expect(NGN.minorUnitsPerMajor).toBe(100n);
  });

  it('rejects unknown or malformed codes', () => {
    expect(Currency.isValid('XYZ')).toBe(false);
    expect(Currency.isValid('ngn')).toBe(false);
    expect(() => Currency.of('XYZ')).toThrow(RangeError);
  });

  it('returns the same instance per code', () => {
    expect(Currency.of('NGN')).toBe(NGN);
  });
});

describe('ExchangeRate', () => {
  it('parses decimals exactly', () => {
    const rate = ExchangeRate.parse('1550.25');

    expect(rate.numerator).toBe(155025n);
    expect(rate.denominator).toBe(100n);
    expect(rate.toString()).toBe('1550.25');
  });

  it('normalises trailing zeros', () => {
    expect(ExchangeRate.parse('1.000').isOne).toBe(true);
    expect(ExchangeRate.parse('1550.50').toString()).toBe('1550.5');
  });

  it.each(['0', '0.0', '-1', '1e3', 'abc', '', '1.'])('rejects %j', (text) => {
    expect(ExchangeRate.isValid(text)).toBe(false);
    expect(() => ExchangeRate.parse(text)).toThrow(RangeError);
  });
});

describe('Money', () => {
  it('adds and subtracts in one currency', () => {
    const a = Money.of(350000, NGN);
    const b = Money.of(175000, 'NGN');

    expect(a.add(b).equals(Money.of(525000, NGN))).toBe(true);
    expect(a.subtract(b).equals(b)).toBe(true);
    expect(b.negate().amountMinor).toBe(-175000n);
  });

  it('refuses to mix currencies', () => {
    expect(() => Money.of(1, NGN).add(Money.of(1, USD))).toThrow(
      'Cannot combine NGN with USD',
    );
  });

  it('refuses fractional minor units', () => {
    expect(() => Money.of(12.5, NGN)).toThrow(RangeError);
  });

  it('sums a list', () => {
    expect(
      Money.sum([Money.of(1, NGN), Money.of(2, NGN)], NGN).amountMinor,
    ).toBe(3n);
    expect(Money.sum([], NGN).isZero()).toBe(true);
  });

  describe('allocate', () => {
    it('splits ₦3,500 into VAT and net revenue without losing a kobo', () => {
      const [vat, net] = Money.of(350000, NGN).allocate([75n, 1000n]);

      expect(vat.amountMinor + net.amountMinor).toBe(350000n);
      expect(vat.amountMinor).toBe(24419n);
      expect(net.amountMinor).toBe(325581n);
    });

    it('hands the remainder out one unit at a time from the first part', () => {
      const parts = Money.of(100, NGN).allocate([1n, 1n, 1n]);

      expect(parts.map((p) => p.amountMinor)).toEqual([34n, 33n, 33n]);
    });

    it('never gives remainder to a zero-ratio part', () => {
      const parts = Money.of(5, NGN).allocate([0n, 1n, 1n]);

      expect(parts.map((p) => p.amountMinor)).toEqual([0n, 3n, 2n]);
    });

    it('allocates negative amounts symmetrically', () => {
      const parts = Money.of(-100, NGN).allocate([1n, 1n, 1n]);

      expect(parts.map((p) => p.amountMinor)).toEqual([-34n, -33n, -33n]);
    });

    it('rejects empty or all-zero ratios', () => {
      expect(() => Money.of(1, NGN).allocate([])).toThrow(RangeError);
      expect(() => Money.of(1, NGN).allocate([0n, 0n])).toThrow(RangeError);
    });
  });

  describe('convert', () => {
    it('converts USD cents to NGN kobo', () => {
      // $12.34 at ₦1550.25 = ₦19,130.085 → rounds half up to ₦19,130.09
      const ngn = Money.of(1234, USD).convert(
        NGN,
        ExchangeRate.parse('1550.25'),
      );

      expect(ngn.equals(Money.of(1913009, NGN))).toBe(true);
    });

    it('adjusts for currencies with different minor units', () => {
      // ₦1,000.00 at 0.0975 JPY per NGN = ¥97.5 → ¥98
      const jpy = Money.of(100000, NGN).convert(
        JPY,
        ExchangeRate.parse('0.0975'),
      );

      expect(jpy.equals(Money.of(98, JPY))).toBe(true);
    });

    it('rounds negative amounts half away from zero', () => {
      const jpy = Money.of(-100000, NGN).convert(
        JPY,
        ExchangeRate.parse('0.0975'),
      );

      expect(jpy.amountMinor).toBe(-98n);
    });

    it('is a no-op in the same currency at rate 1', () => {
      const money = Money.of(123, NGN);

      expect(money.convert(NGN, ExchangeRate.ONE)).toBe(money);
    });
  });

  it('serialises the amount as a string with its currency code', () => {
    expect(JSON.parse(JSON.stringify(Money.of(350000n, NGN)))).toEqual({
      amount: '350000',
      currency: 'NGN',
    });
  });
});
