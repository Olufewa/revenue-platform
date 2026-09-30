const SUPPORTED = new Set(Intl.supportedValuesOf('currency'));

/** An ISO 4217 currency and how many minor units make up one major unit. */
export class Currency {
  private static readonly cache = new Map<string, Currency>();

  private constructor(
    readonly code: string,
    readonly fractionDigits: number,
  ) {}

  static isValid(code: string): boolean {
    return /^[A-Z]{3}$/.test(code) && SUPPORTED.has(code);
  }

  static of(code: string): Currency {
    const cached = Currency.cache.get(code);
    if (cached) return cached;

    if (!Currency.isValid(code)) {
      throw new RangeError(`Unknown currency "${code}"`);
    }

    const fractionDigits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2;

    const currency = new Currency(code, fractionDigits);
    Currency.cache.set(code, currency);
    return currency;
  }

  /** Minor units per major unit, e.g. 100 for NGN, 1 for JPY. */
  get minorUnitsPerMajor(): bigint {
    return 10n ** BigInt(this.fractionDigits);
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }

  toString(): string {
    return this.code;
  }

  toJSON(): string {
    return this.code;
  }
}
