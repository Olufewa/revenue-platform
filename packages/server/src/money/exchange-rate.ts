/**
 * How many major units of the target currency one major unit of the source
 * currency buys, held as an exact decimal fraction (no floating point).
 */
export class ExchangeRate {
  static readonly ONE = new ExchangeRate(1n, 1n, '1');

  private constructor(
    readonly numerator: bigint,
    readonly denominator: bigint,
    private readonly text: string,
  ) {}

  static isValid(text: string): boolean {
    return /^\d{1,12}(\.\d{1,12})?$/.test(text) && /[1-9]/.test(text);
  }

  static parse(text: string): ExchangeRate {
    if (!ExchangeRate.isValid(text)) {
      throw new RangeError(`Invalid exchange rate "${text}"`);
    }

    const [whole, fraction = ''] = text.split('.');
    const numerator = BigInt(whole + fraction);
    const denominator = 10n ** BigInt(fraction.length);
    const normalised = fraction.replace(/0+$/, '')
      ? `${BigInt(whole)}.${fraction.replace(/0+$/, '')}`
      : `${BigInt(whole)}`;

    return new ExchangeRate(numerator, denominator, normalised);
  }

  get isOne(): boolean {
    return this.numerator === this.denominator;
  }

  toString(): string {
    return this.text;
  }

  toJSON(): string {
    return this.text;
  }
}
