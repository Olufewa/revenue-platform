import { Currency } from './currency.js';
import { ExchangeRate } from './exchange-rate.js';

/**
 * Fowler's Money: an amount in minor units (kobo, cents) tied to its
 * currency. Immutable; arithmetic across currencies is refused.
 */
export class Money {
  private constructor(
    readonly amountMinor: bigint,
    readonly currency: Currency,
  ) {}

  static of(amountMinor: bigint | number, currency: Currency | string): Money {
    if (typeof amountMinor === 'number' && !Number.isSafeInteger(amountMinor)) {
      throw new RangeError('Money amounts must be whole minor units');
    }

    return new Money(
      BigInt(amountMinor),
      typeof currency === 'string' ? Currency.of(currency) : currency,
    );
  }

  static zero(currency: Currency | string): Money {
    return Money.of(0n, currency);
  }

  static sum(values: Money[], currency: Currency | string): Money {
    return values.reduce(
      (total, value) => total.add(value),
      Money.zero(currency),
    );
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  equals(other: Money): boolean {
    return (
      this.currency.equals(other.currency) &&
      this.amountMinor === other.amountMinor
    );
  }

  /**
   * Splits this amount in proportion to `ratios` without losing a minor
   * unit: each part is rounded down, then the leftover units are handed out
   * one at a time from the first part.
   */
  allocate(ratios: bigint[]): Money[] {
    if (ratios.length === 0 || ratios.some((r) => r < 0n)) {
      throw new RangeError('Ratios must be non-negative and non-empty');
    }

    const total = ratios.reduce((sum, r) => sum + r, 0n);
    if (total === 0n) {
      throw new RangeError('Ratios must not all be zero');
    }

    const sign = this.amountMinor < 0n ? -1n : 1n;
    const amount = this.amountMinor * sign;

    const parts = ratios.map((r) => (amount * r) / total);
    let remainder = amount - parts.reduce((sum, p) => sum + p, 0n);

    for (let i = 0; remainder > 0n; i = (i + 1) % parts.length) {
      if (ratios[i] === 0n) continue;
      parts[i] += 1n;
      remainder -= 1n;
    }

    return parts.map((p) => new Money(p * sign, this.currency));
  }

  /** Converts at `rate` (target major units per source major unit), rounding half away from zero. */
  convert(to: Currency, rate: ExchangeRate): Money {
    if (to.equals(this.currency) && rate.isOne) {
      return this;
    }

    const numerator = this.amountMinor * rate.numerator * to.minorUnitsPerMajor;
    const denominator = rate.denominator * this.currency.minorUnitsPerMajor;

    return new Money(divideRoundHalfAway(numerator, denominator), to);
  }

  toString(): string {
    return `${this.amountMinor} ${this.currency.code}`;
  }

  toJSON() {
    return {
      amount: this.amountMinor.toString(),
      currency: this.currency.code,
    };
  }

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) {
      throw new RangeError(
        `Cannot combine ${this.currency.code} with ${other.currency.code}`,
      );
    }
  }
}

function divideRoundHalfAway(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const abs = numerator * sign;
  return ((abs * 2n + denominator) / (2n * denominator)) * sign;
}
